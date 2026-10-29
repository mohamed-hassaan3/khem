/**
 * Apply pending `supabase/sql/*.sql` files in filename order.
 *
 *     npm run db:migrate
 *     npm run db:migrate -- --dry-run
 *     npm run db:migrate -- --baseline-through 0071
 *     npm run db:migrate -- --apply-from-start
 *
 * Existing databases must be baselined explicitly. A baseline records the
 * selected filenames without executing their SQL and requires an interactive
 * confirmation after displaying the exact files and count.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import type { Client } from "pg";

import { connectionString, redactUrl, withClient } from "./db";
import { confirmDatabaseTarget } from "./db-target";
import {
  getBaselineFiles,
  getPendingFiles,
  parseMigrationOptions,
  validateAppliedFiles,
  type MigrationOptions,
} from "./db-migrate-plan";

const SQL_DIR = path.join(process.cwd(), "supabase", "sql");
const LOCK_KEY = 1_384_164_946;
const LOCK_SUBKEY = 1;
const HISTORY_TABLE = "public.schema_migrations";

interface HistoryRow {
  filename: string;
}

async function sqlFiles(): Promise<string[]> {
  const entries = await readdir(SQL_DIR);
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

async function historyTableExists(client: Client): Promise<boolean> {
  const { rows } = await client.query<{ exists: boolean }>(
    `select to_regclass($1) is not null as exists`,
    [HISTORY_TABLE],
  );
  return rows[0]?.exists === true;
}

async function validateHistoryTable(client: Client): Promise<void> {
  const { rows } = await client.query<{ column_name: string; data_type: string; is_nullable: string }>(
    `select column_name, data_type, is_nullable
       from information_schema.columns
      where table_schema = 'public' and table_name = 'schema_migrations'
      order by ordinal_position`,
  );
  const expected = [
    { column_name: "filename", data_type: "text", is_nullable: "NO" },
    { column_name: "applied_at", data_type: "timestamp with time zone", is_nullable: "NO" },
  ];
  if (JSON.stringify(rows) !== JSON.stringify(expected)) {
    throw new Error(
      `${HISTORY_TABLE} has an unexpected schema. Expected exactly ` +
        `filename text NOT NULL and applied_at timestamptz NOT NULL; found ${JSON.stringify(rows)}. ` +
        "Refusing to guess how this history should be interpreted.",
    );
  }

  const { rows: securityRows } = await client.query<{
    rls_enabled: boolean;
    anon_access: boolean;
    authenticated_access: boolean;
  }>(`
    select c.relrowsecurity as rls_enabled,
           has_table_privilege('anon', c.oid, 'SELECT')
             or has_table_privilege('anon', c.oid, 'INSERT')
             or has_table_privilege('anon', c.oid, 'UPDATE')
             or has_table_privilege('anon', c.oid, 'DELETE')
             or has_table_privilege('anon', c.oid, 'TRUNCATE')
             or has_table_privilege('anon', c.oid, 'REFERENCES')
             or has_table_privilege('anon', c.oid, 'TRIGGER') as anon_access,
           has_table_privilege('authenticated', c.oid, 'SELECT')
             or has_table_privilege('authenticated', c.oid, 'INSERT')
             or has_table_privilege('authenticated', c.oid, 'UPDATE')
             or has_table_privilege('authenticated', c.oid, 'DELETE')
             or has_table_privilege('authenticated', c.oid, 'TRUNCATE')
             or has_table_privilege('authenticated', c.oid, 'REFERENCES')
             or has_table_privilege('authenticated', c.oid, 'TRIGGER') as authenticated_access
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'schema_migrations'
  `);
  const security = securityRows[0];
  if (!security?.rls_enabled || security.anon_access || security.authenticated_access) {
    throw new Error(
      `${HISTORY_TABLE} has unexpected access controls. Expected RLS enabled and no table ` +
        "privileges for anon or authenticated. Refusing to continue.",
    );
  }
}

async function readAppliedFiles(client: Client): Promise<string[]> {
  const { rows } = await client.query<HistoryRow>(
    `select filename from ${HISTORY_TABLE} order by filename`,
  );
  return rows.map((row) => row.filename);
}

async function createHistoryTable(client: Client): Promise<void> {
  await client.query(`
    create table ${HISTORY_TABLE} (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);
  await client.query(`alter table ${HISTORY_TABLE} enable row level security`);
  await client.query(`revoke all on table ${HISTORY_TABLE} from public, anon, authenticated`);
  await client.query(`grant select, insert on table ${HISTORY_TABLE} to current_user`);
}

async function confirmBaseline(files: string[]): Promise<boolean> {
  console.log(`\nBaseline preview: ${files.length} file(s) will be marked applied without running SQL:`);
  for (const name of files) console.log(`  ${name}`);
  const expected = "BASELINE 0001-0071";
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error(
      `Baseline requires an interactive terminal. Re-run and type ${expected} when prompted.`,
    );
  }
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await readline.question(`\nType ${expected} to record these files: `);
    return answer.trim() === expected;
  } finally {
    readline.close();
  }
}

async function confirmApplyFromStart(): Promise<boolean> {
  const expected = "APPLY ALL MIGRATIONS";
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error(
      `Applying from the beginning requires an interactive terminal. Type ${expected} when prompted.`,
    );
  }
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await readline.question(
      `This will execute every migration file. Type ${expected} to continue: `,
    );
    return answer.trim() === expected;
  } finally {
    readline.close();
  }
}

async function recordBaseline(client: Client, files: string[]): Promise<void> {
  await client.query("begin");
  try {
    await createHistoryTable(client);
    for (const filename of files) {
      await client.query(`insert into ${HISTORY_TABLE} (filename) values ($1)`, [filename]);
    }
    await client.query("commit");
  } catch (cause) {
    await client.query("rollback");
    throw cause;
  }
}

async function applyFile(client: Client, filename: string): Promise<void> {
  const sql = await readFile(path.join(SQL_DIR, filename), "utf8");
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query(`insert into ${HISTORY_TABLE} (filename) values ($1)`, [filename]);
    await client.query("commit");
  } catch (cause) {
    await client.query("rollback");
    throw cause;
  }
}

async function runWithLock<T>(work: (client: Client) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query("select pg_advisory_lock($1, $2)", [LOCK_KEY, LOCK_SUBKEY]);
    try {
      return await work(client);
    } finally {
      await client.query("select pg_advisory_unlock($1, $2)", [LOCK_KEY, LOCK_SUBKEY]);
    }
  });
}

async function migrate(client: Client, files: string[], options: MigrationOptions): Promise<void> {
  const tableExists = await historyTableExists(client);

  if (!tableExists) {
    if (options.dryRun) {
      console.log(`No migration history table. Pending files (${files.length}):`);
      for (const name of files) console.log(`  ${name}`);
      return;
    }

    if (options.baselineThrough) {
      const baselineFiles = getBaselineFiles(files, options.baselineThrough);
      if (!(await confirmBaseline(baselineFiles))) {
        throw new Error("Baseline confirmation did not match. No history was recorded.");
      }
      await recordBaseline(client, baselineFiles);
      console.log(`Recorded ${baselineFiles.length} baseline file(s) through ${options.baselineThrough}.`);
    } else if (!options.applyFromStart || !(await confirmApplyFromStart())) {
      throw new Error(
        "No migration history table exists. For an existing database use --baseline-through 0071; " +
          "for a new empty database use --apply-from-start.",
      );
    } else {
      await client.query("begin");
      try {
        await createHistoryTable(client);
        await client.query("commit");
      } catch (cause) {
        await client.query("rollback");
        throw cause;
      }
    }
  } else {
    if (options.baselineThrough || options.applyFromStart) {
      throw new Error("Baseline and --apply-from-start are valid only when the history table is absent.");
    }
    await validateHistoryTable(client);
  }

  const applied = await readAppliedFiles(client);
  validateAppliedFiles(files, applied);
  const pending = getPendingFiles(files, applied);

  if (options.dryRun) {
    console.log(`Pending files (${pending.length}):`);
    for (const name of pending) console.log(`  ${name}`);
    return;
  }

  if (pending.length === 0) {
    console.log("No pending migration files.");
    return;
  }

  console.log(`Applying ${pending.length} pending file(s):`);
  for (const name of pending) {
    const started = Date.now();
    await applyFile(client, name);
    console.log(`  ✓ ${name}  (${Date.now() - started} ms)`);
  }

  await client.query("notify pgrst, 'reload schema'");
  console.log("Schema applied. PostgREST schema cache reload signalled.");
}

async function main(): Promise<void> {
  const options = parseMigrationOptions(process.argv.slice(2));
  const databaseUrl = connectionString();
  await confirmDatabaseTarget(databaseUrl, "migrate");
  const files = await sqlFiles();

  if (files.length === 0) {
    throw new Error(`No .sql files in ${SQL_DIR}`);
  }

  console.log(`Migration target: ${redactUrl(databaseUrl)}`);
  await runWithLock((client) => migrate(client, files, options));
}

main().catch((cause: unknown) => {
  console.error(
    `Migration failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
  );
  process.exitCode = 1;
});
