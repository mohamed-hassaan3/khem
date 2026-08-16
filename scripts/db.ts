/**
 * Shared Postgres connection for the `db:*` scripts.
 *
 * These scripts run on a developer's machine (or in CI), never in the app.
 * Nothing under `src/` imports this file — the application talks to Supabase
 * through the Data API, where row level security applies. Here we hold a
 * superuser-grade connection, which is the whole reason it lives in `scripts/`.
 *
 * ## Why the pooler and not `DIRECT_CONNECTION_STRING`
 *
 * `db.<ref>.supabase.co` publishes an AAAA record and no A record. On a network
 * without IPv6 — most home and office networks, and many CI runners — it simply
 * does not resolve. `SUPABASE_DB_URL` points at the same database through
 * Supavisor in *session* mode, which is IPv4 and speaks the full protocol
 * including DDL and transactions.
 *
 * ## Secrets
 *
 * The URL carries the database password. It is read from `.env.local` (which is
 * gitignored) and is never logged, never printed on failure, and never written
 * to a file. `redactUrl()` exists so an error message can still say *which*
 * host failed.
 */

import { Client } from "pg";

/** Connection string, or a clear failure. Never returns an empty string. */
export function connectionString(): string {
  const url = process.env.SUPABASE_DB_URL ?? process.env.DIRECT_CONNECTION_STRING;

  if (!url) {
    throw new Error(
      "No database URL. Set SUPABASE_DB_URL (session pooler, IPv4) in .env.local.",
    );
  }

  return url;
}

/** Host and database only — safe to print. */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "<unparseable database url>";
  }
}

/**
 * A connected client.
 *
 * `rejectUnauthorized: false` because Supabase's pooler presents a certificate
 * signed by its own CA, which is not in Node's trust store. The connection is
 * still encrypted; what is skipped is chain verification against a public root.
 * Pinning the Supabase CA bundle would be stricter, and is worth doing if these
 * scripts ever run somewhere untrusted.
 */
export async function connect(): Promise<Client> {
  const url = connectionString();
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    // Long enough for a cold pooler, short enough to fail rather than hang.
    connectionTimeoutMillis: 15_000,
    statement_timeout: 120_000,
  });

  try {
    await client.connect();
  } catch (cause) {
    throw new Error(
      `Could not connect to ${redactUrl(url)}: ${
        cause instanceof Error ? cause.message : "unknown error"
      }`,
    );
  }

  return client;
}

/** Run `work` against a connected client, closing it whatever happens. */
export async function withClient<T>(
  work: (client: Client) => Promise<T>,
): Promise<T> {
  const client = await connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** Run `work` inside a transaction, rolling back on any throw. */
export async function withTransaction<T>(
  work: (client: Client) => Promise<T>,
): Promise<T> {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      const result = await work(client);
      await client.query("commit");
      return result;
    } catch (cause) {
      await client.query("rollback");
      throw cause;
    }
  });
}
