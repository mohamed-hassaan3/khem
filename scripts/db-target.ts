import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

export type DatabaseOperation = "seed" | "migrate";

export interface DatabaseTargetOptions {
  /** Override TTY detection for isolated tests. */
  interactive?: boolean;
  /** Override the prompt for isolated tests. */
  confirmInteractive?: (host: string, operation: DatabaseOperation) => Promise<string>;
  /** Override environment values for isolated tests. */
  env?: Readonly<Record<string, string | undefined>>;
  /** Override logging for isolated tests. */
  log?: (message: string) => void;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** Normalize URL.hostname output, including its bracketed IPv6 representation. */
export function normalizeDatabaseHost(hostname: string): string {
  const lowercase = hostname.toLowerCase();
  if (lowercase.startsWith("[") && lowercase.endsWith("]")) {
    return lowercase.slice(1, -1);
  }
  return lowercase;
}

/** Local means one of the three exact loopback hostnames, never a substring. */
export function isLocalDatabaseHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(normalizeDatabaseHost(hostname));
}

/** Confirm the destination before opening a connection to a remote database. */
export async function confirmDatabaseTarget(
  databaseUrl: string,
  operation: DatabaseOperation,
  options: DatabaseTargetOptions = {},
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(`The database URL could not be parsed. Refusing to ${operation}.`);
  }

  if ([...parsed.searchParams.keys()].some((key) => key.toLowerCase() === "host")) {
    throw new Error(`The database URL must not contain a host query parameter. Refusing to ${operation}.`);
  }

  const host = normalizeDatabaseHost(parsed.hostname);
  if (!host) {
    throw new Error(`The database URL has no hostname. Refusing to ${operation}.`);
  }

  const log = options.log ?? console.log;
  log(`Database target: ${parsed.host}${parsed.pathname}`);
  if (isLocalDatabaseHost(host)) {
    log(`Local database host confirmed: ${host}.`);
    return;
  }

  const confirmationVariable =
    operation === "seed" ? "KHEM_SEED_CONFIRM" : "KHEM_MIGRATE_CONFIRM";

  const interactive = options.interactive ?? (stdin.isTTY === true && stdout.isTTY === true);
  if (interactive) {
    const answer = options.confirmInteractive
      ? await options.confirmInteractive(host, operation)
      : await promptForHost(host, operation);
    if (answer.trim() !== host) {
      throw new Error(`Confirmation did not match ${host}. Refusing to ${operation}.`);
    }
    return;
  }

  const env = options.env ?? process.env;
  if ((env[confirmationVariable] ?? "").trim() !== host) {
    throw new Error(
      `Refusing to ${operation} non-local database host ${host} without ` +
        `${confirmationVariable}=${host}.`,
    );
  }
}

async function promptForHost(
  host: string,
  operation: DatabaseOperation,
): Promise<string> {
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    return await readline.question(
      `Remote database host. Type ${host} to confirm ${operation}: `,
    );
  } finally {
    readline.close();
  }
}
