/**
 * Prove the database matches the export, holds together, and is locked down.
 *
 *     npm run db:verify
 *
 * Exits non-zero on the first failed assertion, so it is safe to put in CI or
 * in a deploy gate. Three families of check:
 *
 *   counts     — every table holds what `supabase/seed/*.json` says it should.
 *   integrity  — the joins the UI performs all resolve, and the invariants the
 *                components render against hold (one primary image, a featured
 *                product that exists, subjects that match the validation list).
 *   security   — RLS is on everywhere, the public roles can read published rows
 *                and *only* published rows, and they cannot write anything.
 *
 * The security checks matter most and are the reason this script exists rather
 * than a handful of ad-hoc queries: a policy is only as good as the last time
 * somebody proved it still refuses.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import type { Client } from "pg";

import { ENQUIRY_SUBJECTS } from "../src/constants/contact";
import { connectionString, redactUrl, withClient } from "./db";

const SEED_DIR = path.join(process.cwd(), "supabase", "seed");

const failures: string[] = [];
let checks = 0;

function check(ok: boolean, description: string, detail = ""): void {
  checks += 1;
  if (ok) return;
  failures.push(detail ? `${description} — ${detail}` : description);
}

async function readSeed(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(SEED_DIR, name), "utf8")) as Record<
    string,
    unknown
  >;
}

async function count(client: Client, table: string): Promise<number> {
  const { rows } = await client.query<{ n: string }>(
    `select count(*)::text as n from public."${table}"`,
  );
  return Number(rows[0].n);
}

async function scalar<T>(client: Client, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await client.query(sql, params);
  return rows[0]?.value as T;
}

// ── Counts ────────────────────────────────────────────────────

async function verifyCounts(client: Client): Promise<void> {
  const catalog = await readSeed("catalog.json");
  const content = await readSeed("content.json");
  const directory = await readSeed("directory.json");

  const products = catalog.products as { images: unknown[] }[];
  const ingredients = content.ingredients as { usedIn: unknown[] }[];

  const expected: Record<string, number> = {
    Collection: (catalog.collections as unknown[]).length,
    Product: products.length,
    ProductImage: products.reduce((total, product) => total + product.images.length, 0),
    Testimonial: (content.testimonials as unknown[]).length,
    IngredientFamily: (content.ingredientFamilies as unknown[]).length,
    Ingredient: ingredients.length,
    IngredientUsage: ingredients.reduce((total, i) => total + i.usedIn.length, 0),
    Article: (content.articles as unknown[]).length,
    TimelineEvent: (content.timeline as unknown[]).length,
    BrandValue: (content.brandValues as unknown[]).length,
    MissionStatement: (content.missionStatements as unknown[]).length,
    CraftPillar: (content.craftPillars as unknown[]).length,
    CraftStep: (content.craftSteps as unknown[]).length,
    CraftStat: (content.craftStats as unknown[]).length,
    CraftQuote: content.craftQuote ? 1 : 0,
    Stockist: (directory.stockists as unknown[]).length,
    ContactChannel: (directory.contactChannels as unknown[]).length,
    SocialProfile: (directory.socialProfiles as unknown[]).length,
    EnquirySubject: ENQUIRY_SUBJECTS.length,
    BoutiqueSetting: 1,
    LegalDocument: (directory.legalDocuments as unknown[]).length,
  };

  for (const [table, want] of Object.entries(expected)) {
    const got = await count(client, table);
    check(got === want, `${table} row count`, `expected ${want}, found ${got}`);
  }
}

// ── Integrity ─────────────────────────────────────────────────

async function verifyIntegrity(client: Client): Promise<void> {
  const orphanImages = await scalar<string>(
    client,
    `select count(*)::text as value
       from public."ProductImage" i
      where not exists (select 1 from public."Product" p where p.slug = i."productSlug")`,
  );
  check(Number(orphanImages) === 0, "every image belongs to a product", `${orphanImages} orphans`);

  const withoutPrimary = await scalar<string>(
    client,
    `select count(*)::text as value
       from public."Product" p
      where not exists (
        select 1 from public."ProductImage" i
         where i."productSlug" = p.slug and i."isPrimary"
      )`,
  );
  check(
    Number(withoutPrimary) === 0,
    "every product has a primary image",
    `${withoutPrimary} without one`,
  );

  const orphanUsages = await scalar<string>(
    client,
    `select count(*)::text as value
       from public."IngredientUsage" u
      where not exists (select 1 from public."Product" p where p.slug = u."productSlug")`,
  );
  check(Number(orphanUsages) === 0, "every ingredient usage resolves", `${orphanUsages} orphans`);

  const unknownFamilies = await scalar<string>(
    client,
    `select count(*)::text as value
       from public."Ingredient" i, unnest(i.families) as f
      where not exists (select 1 from public."IngredientFamily" v where v.name = f)`,
  );
  check(Number(unknownFamilies) === 0, "ingredient families are in the taxonomy");

  const featured = await scalar<string | null>(
    client,
    `select p.slug as value
       from public."BoutiqueSetting" s
       join public."Product" p on p.slug = s."featuredProductSlug"
      where s.id = 'default'`,
  );
  check(Boolean(featured), "the featured product resolves to a real fragrance");

  const fragranceless = await scalar<string>(
    client,
    `select count(*)::text as value
       from public."Product" p
       join public."Collection" c on c.slug = p."collectionSlug"
      where c.kind = 'FRAGRANCE' and p.concentration is null`,
  );
  check(Number(fragranceless) === 0, "every fragrance states a concentration");

  const strengthless = await scalar<string>(
    client,
    `select count(*)::text as value
       from public."Product" p
       join public."Collection" c on c.slug = p."collectionSlug"
      where c.kind <> 'FRAGRANCE' and p.format is null`,
  );
  check(Number(strengthless) === 0, "every non-fragrance states a format");

  const subjects = await client.query<{ label: string }>(
    `select label from public."EnquirySubject" order by "sortOrder"`,
  );
  check(
    JSON.stringify(subjects.rows.map((row) => row.label)) ===
      JSON.stringify([...ENQUIRY_SUBJECTS]),
    "EnquirySubject matches ENQUIRY_SUBJECTS in src/constants/contact.ts",
  );

  const badSections = await scalar<string>(
    client,
    `select count(*)::text as value
       from public."LegalDocument"
      where jsonb_array_length(sections) = 0`,
  );
  check(Number(badSections) === 0, "every legal document has sections");

  const embedded = await scalar<string>(
    client,
    `select count(*)::text as value from public."Product" where embedding is not null`,
  );
  const total = await count(client, "Product");
  console.log(
    `  note: ${embedded}/${total} products carry an embedding` +
      (Number(embedded) === 0 ? " — run `npm run embed`" : ""),
  );
}

// ── Sales ledger ──────────────────────────────────────────────

/**
 * The four things that must be true of `order_item_sales_ledger`, always.
 *
 * Written as assertions over whatever the database actually holds rather than
 * over a fixture, because the interesting failure is not "the function is
 * wrong today" — `npm run db:test:sales` covers that with real scenarios — it
 * is "something wrote an order without one", which only real data can show.
 *
 * 1. **Coverage.** Every order line has a ledger row. `place_order()` writes
 *    one in the same transaction and the migration backfilled the rest, so a
 *    gap means an order reached the book by a path nobody has accounted for.
 * 2. **Uniqueness.** No line has two. The unique index makes this structural;
 *    asserting it is how a dropped index gets noticed.
 * 3. **The line balances.** Original minus everything taken off equals what was
 *    paid — the arithmetic the five discount columns exist to make auditable.
 * 4. **The order sums.** An order's rows add up to its merchandise total,
 *    delivery excluded. This is the one that would catch a benefit apportioned
 *    to nothing, and it is the reason the allocation uses largest remainder
 *    rather than independent rounding.
 */
async function verifySalesLedger(client: Client): Promise<void> {
  const uncovered = await scalar<string>(
    client,
    `select count(*)::text as value
       from public."OrderItem" i
      where not exists (
        select 1 from public.order_item_sales_ledger l
         where l."orderItemId" = i.id
      )`,
  );
  check(
    Number(uncovered) === 0,
    "every order line has a sales-ledger row",
    `${uncovered} line(s) unrecorded`,
  );

  const duplicated = await scalar<string>(
    client,
    `select count(*)::text as value
       from (
         select l."orderItemId"
           from public.order_item_sales_ledger l
          group by l."orderItemId"
         having count(*) > 1
       ) d`,
  );
  check(
    Number(duplicated) === 0,
    "no order line has been recorded twice",
    `${duplicated} line(s) duplicated`,
  );

  const unbalanced = await scalar<string>(
    client,
    `select count(*)::text as value
       from public.order_item_sales_ledger l
      where l."originalLineTotalInCents" - l."totalDiscountInCents"
            <> l."paidInCents"`,
  );
  check(
    Number(unbalanced) === 0,
    "every ledger line balances: original − discounts = paid",
    `${unbalanced} line(s) do not`,
  );

  const mismatched = await scalar<string>(
    client,
    `select count(*)::text as value
       from (
         select o.id
           from public."Order" o
           join public.order_item_sales_ledger l on l."orderId" = o.id
          group by o.id, o."totalInCents", o."shipInCents"
         having coalesce(sum(l."paidInCents"), 0)::int
                <> o."totalInCents" - o."shipInCents"
       ) bad`,
  );
  check(
    Number(mismatched) === 0,
    "every order's ledger sums to its merchandise total, delivery excluded",
    `${mismatched} order(s) do not`,
  );

  const negative = await scalar<string>(
    client,
    `select count(*)::text as value
       from public.order_item_sales_ledger l
      where l."paidInCents" < 0 or l."totalDiscountInCents" < 0`,
  );
  check(
    Number(negative) === 0,
    "no ledger line carries a negative amount",
    `${negative} line(s) do`,
  );

  // Not a failure — a boutique that has not costed its catalogue yet is in a
  // normal state, and the dashboard says so on every screen. Reported so the
  // gap is visible from CI rather than only from `/admin/sales`.
  const uncosted = await scalar<string>(
    client,
    `select count(*)::text as value
       from public."Product"
      where "costInCents" is null and not "isArchived"`,
  );
  const live = await scalar<string>(
    client,
    `select count(*)::text as value from public."Product" where not "isArchived"`,
  );
  console.log(
    `  note: ${uncosted}/${live} live products have no cost recorded` +
      (Number(uncosted) > 0
        ? " — profit reporting is incomplete until they do"
        : ""),
  );
}

// ── Finance ───────────────────────────────────────────────────

/**
 * The invariants that make Finance trustworthy.
 *
 * Three of them matter more than the rest, and all three are structural rather
 * than behavioural — they are true of the data as it sits, so a bug that broke
 * one is caught here even if nobody happened to open the screen it would have
 * shown up on.
 *
 *   · No recurring period is ever recorded twice.
 *   · Every expense carries the category name it was written under, so a rename
 *     cannot rewrite a closed month.
 *   · Finance's revenue for a window is *identical* to the sales ledger's for
 *     the same window — the guarantee that Finance never became a second sales
 *     engine.
 */
async function verifyFinance(client: Client): Promise<void> {
  const categories = await count(client, "expense_categories");
  check(
    categories >= 34,
    "the shipped expense categories are present",
    `${categories} found, expected at least 34`,
  );

  const duplicated = await scalar<string>(
    client,
    `select count(*)::text as value
       from (
         select e."recurringRuleId", e."periodKey"
           from public.expenses e
          where e."recurringRuleId" is not null
          group by e."recurringRuleId", e."periodKey"
         having count(*) > 1
       ) d`,
  );
  check(
    Number(duplicated) === 0,
    "no recurring expense period has been generated twice",
    `${duplicated} period(s) duplicated`,
  );

  const halfRecurring = await scalar<string>(
    client,
    `select count(*)::text as value
       from public.expenses e
      where (e."recurringRuleId" is null) <> (e."periodKey" is null)`,
  );
  check(
    Number(halfRecurring) === 0,
    "every expense is either wholly recurring or wholly one-time",
    `${halfRecurring} row(s) carry only half a recurrence`,
  );

  const unsnapshotted = await scalar<string>(
    client,
    `select count(*)::text as value
       from public.expenses e
      where e."categoryName" is null or btrim(e."categoryName") = ''`,
  );
  check(
    Number(unsnapshotted) === 0,
    "every expense snapshots the category name it was written under",
    `${unsnapshotted} row(s) do not`,
  );

  const orphaned = await scalar<string>(
    client,
    `select count(*)::text as value
       from public.expenses e
      where not exists (
        select 1 from public.expense_categories c where c.id = e."categoryId"
      )`,
  );
  check(
    Number(orphaned) === 0,
    "every expense points at a category that exists",
    `${orphaned} row(s) do not`,
  );

  const badMonths = await scalar<string>(
    client,
    `select count(*)::text as value
       from public.financial_targets t
      where t."periodMonth" <> date_trunc('month', t."periodMonth")::date`,
  );
  check(
    Number(badMonths) === 0,
    "every financial target is stamped on the first of its month",
    `${badMonths} row(s) are not`,
  );

  /*
   * The one that matters most: Finance and Sales & Profit must agree, to the
   * piastre, about what an all-time window earned. They read the same view
   * through different functions, and this is what proves the second one did not
   * quietly acquire a definition of its own.
   */
  const drift = await scalar<string>(
    client,
    `select (f."revenueInCents" - s."revenueInCents")::text as value
       from public.finance_summary(null, null, null) f
       cross join public.sales_ledger_summary(null, null, null) s`,
  );
  check(
    Number(drift) === 0,
    "Finance and Sales & Profit report identical revenue",
    `they differ by ${drift} piastres`,
  );

  const netDrift = await scalar<string>(
    client,
    `select count(*)::text as value
       from public.finance_summary(null, null, null) f
      where f."netProfitInCents" is distinct from
            (f."grossProfitInCents" - f."expenseInCents")`,
  );
  check(
    Number(netDrift) === 0,
    "net profit is exactly gross profit less operating expenses",
  );

  const seriesDrift = await scalar<string>(
    client,
    `select (
       (select coalesce(sum(d."expenseInCents"), 0)
          from public.finance_daily(null, null, null) d)
       - (select f."expenseInCents"
            from public.finance_summary(null, null, null) f)
     )::text as value`,
  );
  check(
    Number(seriesDrift) === 0,
    "the daily series sums to the summary it sits beside",
    `they differ by ${seriesDrift} piastres`,
  );
}

// ── Security ──────────────────────────────────────────────────

async function verifySecurity(client: Client): Promise<void> {
  const unprotected = await client.query<{ relname: string }>(
    `select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
  );
  check(
    unprotected.rowCount === 0,
    "row level security is enabled on every public table",
    unprotected.rows.map((row) => row.relname).join(", "),
  );

  const writePolicies = await client.query<{ tablename: string; policyname: string }>(
    `select tablename, policyname
       from pg_policies
      where schemaname = 'public'
        and cmd <> 'SELECT'
        and (roles && array['anon', 'authenticated']::name[])`,
  );
  check(
    writePolicies.rowCount === 0,
    "no write policy exists for anon or authenticated",
    writePolicies.rows.map((row) => `${row.tablename}.${row.policyname}`).join(", "),
  );

  const writeGrants = await client.query<{ table_name: string; privilege_type: string }>(
    `select table_name, privilege_type
       from information_schema.role_table_grants
      where table_schema = 'public'
        and grantee in ('anon', 'authenticated')
        and privilege_type <> 'SELECT'`,
  );
  check(
    writeGrants.rowCount === 0,
    "the public roles hold no write grant",
    writeGrants.rows.map((row) => `${row.table_name}:${row.privilege_type}`).join(", "),
  );

  /*
   * Does the policy actually hide an archived product? Proven by inserting one
   * and looking at it through the `anon` role — then rolling the whole thing
   * back, so the probe leaves nothing behind even if this script is killed
   * mid-run.
   */
  await client.query("begin");
  try {
    await client.query(
      `insert into public."Product" (
         id, name, slug, description, concentration, "volumeMl", "priceInCents",
         sku, "collectionSlug", "isArchived"
       )
       select '__rls_probe__', 'RLS probe', '__rls_probe__', 'probe', 'PARFUM',
              1, 1, '__RLS_PROBE__', slug, true
         from public."Collection" limit 1`,
    );

    await client.query("set local role anon");
    const visible = await client.query(
      `select 1 from public."Product" where slug = '__rls_probe__'`,
    );
    check(visible.rowCount === 0, "an archived product is invisible to anon");

    const published = await client.query(`select 1 from public."Product" limit 1`);
    check((published.rowCount ?? 0) > 0, "a published product is visible to anon");
  } finally {
    await client.query("rollback");
  }
}

/**
 * The same questions asked through the Data API, with the key the app actually
 * ships to production. The SQL checks above prove the policies; this proves the
 * key those policies apply to.
 */
async function verifyDataApi(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.log("  note: skipping Data API checks — publishable key not configured");
    return;
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const read = await supabase.from("Product").select("slug").limit(1);
  check(!read.error && (read.data?.length ?? 0) > 0, "publishable key can read the catalog", read.error?.message);

  const write = await supabase
    .from("Product")
    .insert({ id: "__probe__", name: "probe", slug: "__probe__" });
  check(write.error !== null, "publishable key cannot write the catalog");

  const comment = await supabase
    .from("product_comment")
    .insert({ product_slug: "kyphi", body: "probe" });
  check(comment.error !== null, "publishable key cannot post a comment");
}

async function main(): Promise<void> {
  console.log(`Verifying ${redactUrl(connectionString())}`);

  await withClient(async (client) => {
    await verifyCounts(client);
    await verifyIntegrity(client);
    await verifySalesLedger(client);
    await verifyFinance(client);
    await verifySecurity(client);
  });

  await verifyDataApi();

  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${checks} checks failed:`);
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nAll ${checks} checks passed.`);
}

main().catch((cause: unknown) => {
  console.error(
    `Verification failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
  );
  process.exitCode = 1;
});
