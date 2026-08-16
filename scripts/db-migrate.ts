/**
 * Apply `supabase/sql/*.sql` to the database, in filename order.
 *
 *     npm run db:migrate
 *
 * Every file is idempotent by construction (`create … if not exists`, `create or
 * replace`, `drop policy if exists` before `create policy`), so this is safe to
 * re-run: the second run changes nothing and reports the same list.
 *
 * ## Why not the Supabase CLI
 *
 * The CLI is the right tool once a team is versioning migrations, and these
 * files are written so that adopting it is a copy — `supabase migration new
 * <name>` and paste. Today the repository has no CLI, no Docker, and no
 * migration history table, and inventing timestamped filenames by hand is
 * exactly what `supabase/README.md` warns against. This script applies the
 * reviewed SQL and nothing else.
 *
 * ## Transactions
 *
 * All files run inside **one** transaction: a half-applied schema is worse than
 * an unapplied one, and every statement here is transactional DDL (Postgres
 * supports it; `create index concurrently` would not, and none is used).
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { connectionString, redactUrl, withTransaction } from "./db";

const SQL_DIR = path.join(process.cwd(), "supabase", "sql");

async function sqlFiles(): Promise<string[]> {
  const entries = await readdir(SQL_DIR);
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

async function main(): Promise<void> {
  const files = await sqlFiles();

  if (files.length === 0) {
    throw new Error(`No .sql files in ${SQL_DIR}`);
  }

  console.log(`Applying ${files.length} file(s) to ${redactUrl(connectionString())}`);

  await withTransaction(async (client) => {
    for (const name of files) {
      const sql = await readFile(path.join(SQL_DIR, name), "utf8");
      const started = Date.now();
      await client.query(sql);
      console.log(`  ✓ ${name}  (${Date.now() - started} ms)`);
    }
  });

  console.log("Schema applied.");
}

main().catch((cause: unknown) => {
  console.error(
    `Migration failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
  );
  process.exitCode = 1;
});
