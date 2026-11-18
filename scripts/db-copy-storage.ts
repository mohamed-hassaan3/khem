/**
 * Copy Supabase Storage from one project to another — `npm run db:copy-storage`.
 *
 * Written for the Tokyo → Frankfurt move (`prompts/supabase-region-migration.md`).
 * A database dump carries `storage.buckets` and `storage.objects` *rows* but not
 * the files behind them, so the files are copied here through the Storage API.
 *
 *   source: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY
 *   target: TARGET_SUPABASE_URL      + TARGET_SUPABASE_SECRET_KEY
 *
 * ## Safety
 *
 * - Refuses when source and target are the same host.
 * - Never deletes anything, in either project.
 * - Idempotent: buckets are created or updated to the source's settings, and
 *   every object is uploaded with `upsert: true`, so a re-run converges.
 * - Prints hostnames, bucket names and counts. Never a key.
 *
 * `--check` copies nothing and exits non-zero unless every source object exists
 * in the target with the same size.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface ObjectEntry {
  path: string;
  size: number;
  contentType: string;
  cacheControl: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set in .env.local.`);
  return value;
}

function admin(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Every object under `prefix`, depth-first. Folders have no `id`. */
async function listAll(
  client: SupabaseClient,
  bucket: string,
  prefix = "",
): Promise<ObjectEntry[]> {
  const out: ObjectEntry[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        out.push(...(await listAll(client, bucket, path)));
      } else {
        const meta = (item.metadata ?? {}) as Record<string, unknown>;
        out.push({
          path,
          size: typeof meta.size === "number" ? meta.size : -1,
          contentType: typeof meta.mimetype === "string" ? meta.mimetype : "application/octet-stream",
          cacheControl: typeof meta.cacheControl === "string" ? meta.cacheControl.replace(/^max-age=/, "") : "3600",
        });
      }
    }

    if (data.length < pageSize) break;
  }

  return out;
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes("--check");

  const sourceUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const targetUrl = required("TARGET_SUPABASE_URL");
  const sourceHost = new URL(sourceUrl).host;
  const targetHost = new URL(targetUrl).host;

  if (sourceHost === targetHost) {
    throw new Error(`Source and target are the same project (${sourceHost}). Refusing.`);
  }

  console.log(`Storage ${checkOnly ? "check" : "copy"}: ${sourceHost} → ${targetHost}`);

  const source = admin(sourceUrl, required("SUPABASE_SECRET_KEY"));
  const target = admin(targetUrl, required("TARGET_SUPABASE_SECRET_KEY"));

  const { data: buckets, error: bucketsError } = await source.storage.listBuckets();
  if (bucketsError) throw new Error(`listBuckets: ${bucketsError.message}`);

  let mismatches = 0;

  for (const bucket of buckets ?? []) {
    const settings = {
      public: bucket.public,
      fileSizeLimit: bucket.file_size_limit ?? undefined,
      allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
    };

    if (!checkOnly) {
      const { data: existing } = await target.storage.getBucket(bucket.id);
      const { error } = existing
        ? await target.storage.updateBucket(bucket.id, settings)
        : await target.storage.createBucket(bucket.id, settings);
      if (error) throw new Error(`bucket ${bucket.id}: ${error.message}`);
    }

    const objects = await listAll(source, bucket.id);
    const targetObjects = new Map(
      (await listAll(target, bucket.id).catch(() => [])).map((entry) => [entry.path, entry.size]),
    );

    let copied = 0;
    for (const object of objects) {
      if (checkOnly) {
        if (targetObjects.get(object.path) !== object.size) {
          mismatches += 1;
          console.log(`  missing or different: ${bucket.id}/${object.path}`);
        }
        continue;
      }

      const { data: blob, error: downloadError } = await source.storage
        .from(bucket.id)
        .download(object.path);
      if (downloadError || !blob) {
        throw new Error(`download ${bucket.id}/${object.path}: ${downloadError?.message ?? "empty"}`);
      }

      const { error: uploadError } = await target.storage
        .from(bucket.id)
        .upload(object.path, blob, {
          upsert: true,
          contentType: object.contentType,
          cacheControl: object.cacheControl,
        });
      if (uploadError) throw new Error(`upload ${bucket.id}/${object.path}: ${uploadError.message}`);
      copied += 1;
    }

    console.log(
      `  ${bucket.id}: ${objects.length} object(s) in source` +
        (checkOnly ? "" : `, ${copied} copied`) +
        ` (public=${bucket.public})`,
    );
  }

  if (checkOnly && mismatches > 0) {
    console.error(`${mismatches} object(s) missing or different in the target.`);
    process.exit(1);
  }

  console.log(checkOnly ? "Storage matches." : "Storage copied.");
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exit(1);
});
