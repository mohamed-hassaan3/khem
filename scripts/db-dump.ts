/**
 * Export the live database into `supabase/seed/*.json`.
 *
 *     npm run db:dump
 *
 * The exact inverse of `db-seed.ts`, and the half that was missing while that
 * script's header told you to "dump it back".
 *
 * ## Why it exists
 *
 * Supabase is the source of truth for everything the site renders — the
 * catalog, the journal, the ingredients, the stockists, the legal documents.
 * All of it is edited in the table editor or the admin dashboard, and the three
 * files under `seed/` are a **generated export** of the result, not a second,
 * hand-maintained copy that drifts out of line the moment a price changes on
 * the platform. Without this script a fresh project seeded from the repository
 * would quietly rebuild the *old* content.
 *
 * So the loop is: edit in Supabase → `npm run db:dump` → read `git diff` →
 * commit. The diff is a readable changelog of what was changed on the platform.
 *
 * ## Safety
 *
 * - **Read-only.** `select` statements and nothing else — no transaction is
 *   opened because none is needed, and there is no code path here that can
 *   modify the database. That is what makes it safe to point at production.
 * - **Refuses to write an empty catalog.** Pointing this at the wrong project
 *   would otherwise replace a real export with `[]`, which the next `db:seed`
 *   would happily preserve (it never deletes) while every fresh environment
 *   built from the repository came up bare. An empty read is a hard failure.
 * - Nothing is interpolated into SQL — every identifier below is a literal in
 *   this file, and there is no input to inject through in the first place.
 * - The connection string carries the database password and is never printed;
 *   `redactUrl()` names the host so a failure is still diagnosable.
 * - Only editorial content is read. No `User`, no `Order`, no `Address`, no
 *   comment: everything these files carry is already public on the storefront.
 *   Do not extend the dumper to tables where that stops being true.
 *
 * ## Round trip
 *
 * `dump → seed → dump` is a fixed point. Key order comes from the object
 * literals below rather than from Postgres, formatting matches the committed
 * file (two-space indent, trailing newline), and rows come back in `"sortOrder"`
 * order — so dumping an unedited database produces an empty `git diff`, and any
 * diff at all is a real change.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import type { Client } from "pg";

import { connectionString, redactUrl, withClient } from "./db";
import type {
  ArticleSeedRow,
  BrandValueSeedRow,
  CatalogSeed,
  CategorySeedRow,
  CollectionSeedRow,
  ContactChannelSeedRow,
  ContentSeed,
  CraftPillarSeedRow,
  CraftQuoteSeedRow,
  CraftStatSeedRow,
  CraftStepSeedRow,
  DirectorySeed,
  EnquirySubjectSeedRow,
  IngredientFamilySeedRow,
  IngredientSeedRow,
  LegalDocumentSeedRow,
  MissionStatementSeedRow,
  ProductImageSeedRow,
  ProductSeedRow,
  StockistSeedRow,
  TestimonialSeedRow,
  TimelineEventSeedRow,
} from "./seed-types";

const SEED_DIR = path.join(process.cwd(), "supabase", "seed");

/*
 * ── Row shapes ──────────────────────────────────────────────
 *
 * What each query returns, stated so the driver's result is typed rather than
 * `any`. They are deliberately close to — but not the same as — the seed row
 * types: these carry `"sortOrder"`, which the file expresses as array position
 * and therefore does not store.
 */

type CategoryRow = CategorySeedRow;
type CollectionRow = CollectionSeedRow;

type ProductRow = Omit<ProductSeedRow, "images">;

interface ImageRow extends ProductImageSeedRow {
  productSlug: string;
}

/**
 * The columns to read, in the order the committed file already prints them.
 *
 * Server-managed columns are absent by design — `createdAt`, `updatedAt`, the
 * search vectors from `0004_search.sql`, the embedding, and `ProductImage.id`,
 * which `db-seed.ts` derives from the product slug. Dumping them would make
 * every export a noisy diff and hand the seeder columns it does not write.
 */
const COLLECTION_COLUMNS = `
  id, name, name_ar, slug, description, description_ar,
  "bannerUrl", "bannerAlt", "bannerAlt_ar",
  "cardUrl", "cardAlt", "cardAlt_ar",
  "isFeatured", kind, "categorySlug"
`;

/*
 * `tags::text[]` because `tags` is an array of the `"ProductTag"` *enum*, and
 * node-postgres only parses arrays whose element type it ships a decoder for —
 * a user-defined enum array comes back as the raw Postgres literal
 * "{NEW_ARRIVAL}", a string, which would land in the file where a JSON array
 * belongs. The cast makes it `text[]`, which the driver does parse. The values
 * are still exactly what the enum permits, so `ProductTag[]` stays true of
 * them. `concentration` needs no cast: a scalar enum is text already.
 */
const PRODUCT_COLUMNS = `
  id, name, slug, subtitle, subtitle_ar, description, description_ar,
  story, story_ar, concentration, format, format_ar, "productType",
  includes, includes_ar, badge, badge_ar, tags::text[] as tags,
  "topNotes", "topNotes_ar", "heartNotes", "heartNotes_ar",
  "baseNotes", "baseNotes_ar",
  "volumeMl", "priceInCents", sku,
  inventory, "inventoryOnline", "inventoryOffline", "isBestseller",
  "collectionSlug"
`;

/**
 * Read the catalog.
 *
 * `order by "sortOrder", id` throughout: `"sortOrder"` is the curated running
 * order the file encodes as array position, and `id` breaks ties so two rows
 * sharing a `"sortOrder"` still come back in the same order on every run.
 */
async function readCatalog(client: Client): Promise<CatalogSeed> {
  const categories = await client.query<CategoryRow>(
    `select id, name, name_ar, slug, description, description_ar,
            "bannerUrl", "bannerAlt", "bannerAlt_ar", kind, "isEnabled"
       from public."Category"
      order by "sortOrder", id`,
  );

  const collections = await client.query<CollectionRow>(
    `select ${COLLECTION_COLUMNS}
       from public."Collection"
      order by "sortOrder", id`,
  );

  const products = await client.query<ProductRow>(
    `select ${PRODUCT_COLUMNS}
       from public."Product"
      order by "sortOrder", id`,
  );

  const images = await client.query<ImageRow>(
    `select "productSlug", url, alt, alt_ar, caption, caption_ar,
            "isPrimary", "sortOrder"
       from public."ProductImage"
      order by "productSlug", "sortOrder"`,
  );

  const setting = await client.query<{ featuredProductSlug: string }>(
    `select "featuredProductSlug"
       from public."BoutiqueSetting"
      where id = 'default'`,
  );

  /*
   * Guard before building anything. An empty catalog is never a legitimate
   * state of this database, so it means the script is pointed somewhere it
   * should not be — and overwriting the export is the one irreversible thing
   * available here.
   */
  if (collections.rowCount === 0 || products.rowCount === 0) {
    throw new Error(
      `Refusing to write an empty catalog: ${redactUrl(connectionString())} ` +
        `returned ${collections.rowCount} collections and ${products.rowCount} products. ` +
        `Check SUPABASE_DB_URL points at a seeded project.`,
    );
  }

  const featuredProductSlug = setting.rows[0]?.featuredProductSlug;

  // The home page's hero product. A missing row would emit a file that seeds a
  // broken home page, which is worse than not emitting one.
  if (!featuredProductSlug) {
    throw new Error(
      `No BoutiqueSetting row with id = 'default', so there is no ` +
        `featuredProductSlug to export. Seed it before dumping.`,
    );
  }

  const byProduct = new Map<string, ProductImageSeedRow[]>();
  for (const image of images.rows) {
    const gallery = byProduct.get(image.productSlug) ?? [];
    // Restated as a literal rather than spread-minus-key, so the image objects
    // in the file carry exactly these seven fields in exactly this order.
    gallery.push({
      url: image.url,
      alt: image.alt,
      alt_ar: image.alt_ar,
      caption: image.caption,
      caption_ar: image.caption_ar,
      isPrimary: image.isPrimary,
      // Kept, unlike the parent rows': `db-seed.ts` reads `image.sortOrder` off
      // the object rather than from array position.
      sortOrder: image.sortOrder,
    });
    byProduct.set(image.productSlug, gallery);
  }

  return {
    categories: categories.rows.map(toCategory),
    collections: collections.rows.map(toCollection),
    products: products.rows.map((product) =>
      toProduct(product, byProduct.get(product.slug) ?? []),
    ),
    featuredProductSlug,
  };
}

/*
 * ── Projections ─────────────────────────────────────────────
 *
 * Explicit literals, never `...row`. Key order in the written file is decided
 * here — by this repository — rather than by whatever order Postgres happens to
 * return columns in, which is what keeps a no-change dump a no-change diff.
 */

function toCategory(row: CategoryRow): CategorySeedRow {
  return {
    id: row.id,
    name: row.name,
    name_ar: row.name_ar,
    slug: row.slug,
    description: row.description,
    description_ar: row.description_ar,
    bannerUrl: row.bannerUrl,
    bannerAlt: row.bannerAlt,
    bannerAlt_ar: row.bannerAlt_ar,
    kind: row.kind,
    isEnabled: row.isEnabled,
  };
}

function toCollection(row: CollectionRow): CollectionSeedRow {
  return {
    id: row.id,
    name: row.name,
    name_ar: row.name_ar,
    slug: row.slug,
    description: row.description,
    description_ar: row.description_ar,
    bannerUrl: row.bannerUrl,
    bannerAlt: row.bannerAlt,
    bannerAlt_ar: row.bannerAlt_ar,
    cardUrl: row.cardUrl,
    cardAlt: row.cardAlt,
    cardAlt_ar: row.cardAlt_ar,
    isFeatured: row.isFeatured,
    kind: row.kind,
    categorySlug: row.categorySlug,
  };
}

function toProduct(
  row: ProductRow,
  images: readonly ProductImageSeedRow[],
): ProductSeedRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    subtitle: row.subtitle,
    subtitle_ar: row.subtitle_ar,
    description: row.description,
    description_ar: row.description_ar,
    story: row.story,
    story_ar: row.story_ar,
    concentration: row.concentration,
    format: row.format,
    /*
     * The typed product kind (`supabase/sql/0041_product_type.sql`). Exported
     * beside `format` and not derived from it: the migration backfills one from
     * the other *once*, and an editor may correct either afterwards. A scalar
     * enum is text already, so it needs no cast.
     */
    productType: row.productType,
    format_ar: row.format_ar,
    includes: row.includes,
    includes_ar: row.includes_ar,
    badge: row.badge,
    badge_ar: row.badge_ar,
    tags: row.tags,
    topNotes: row.topNotes,
    topNotes_ar: row.topNotes_ar,
    heartNotes: row.heartNotes,
    heartNotes_ar: row.heartNotes_ar,
    baseNotes: row.baseNotes,
    baseNotes_ar: row.baseNotes_ar,
    volumeMl: row.volumeMl,
    priceInCents: row.priceInCents,
    sku: row.sku,
    /*
     * The two counters, and the total they add up to.
     *
     * `supabase/sql/0042_inventory_channels.sql` split stock in two and made
     * `inventory` a trigger-maintained total. Exporting only the total would
     * make this file unable to restore stock at all: a seeded row gets
     * online = offline = 0, the trigger recomputes the total as 0, and a fresh
     * environment comes up with the whole catalogue silently sold out. The
     * total is still exported because it is readable, but the counters are what
     * `db-seed.ts` actually writes.
     */
    inventory: row.inventory,
    inventoryOnline: row.inventoryOnline,
    inventoryOffline: row.inventoryOffline,
    isBestseller: row.isBestseller,
    collectionSlug: row.collectionSlug,
    images: [...images],
  };
}


/*
 * ── Editorial content and the directory ─────────────────────
 *
 * The same shape of work as the catalog, over fifteen smaller tables. Each one
 * is a select with an explicit column list in the file's key order, mapped
 * through an explicit literal — no `...row` — for the same reason: this
 * repository decides the key order, so an unchanged database dumps to an
 * unchanged file.
 *
 * Every `_ar` column is here. They are almost all empty today, because the
 * editorial layer has not been translated yet — which is exactly why they must
 * round-trip now. The first article translated in the dashboard has to survive
 * the next `db:seed`, and it will only do that if the export carries it.
 */

/** One `select`, ordered by the curated running order. */
async function rows<T extends object>(
  client: Client,
  table: string,
  columns: string,
  order = '"sortOrder", id',
): Promise<T[]> {
  const result = await client.query<T>(
    `select ${columns} from public."${table}" order by ${order}`,
  );
  return result.rows;
}

/*
 * `to_char(…, 'YYYY-MM-DD')` on every `date` column. node-postgres hands back a
 * JavaScript `Date` for `date`, which `JSON.stringify` would write as a full
 * UTC timestamp — and worse, would shift by a day for anyone west of UTC. The
 * file stores a plain calendar date, so the database formats it.
 */

async function readContent(client: Client): Promise<ContentSeed> {
  const testimonials = await rows<TestimonialSeedRow>(
    client,
    "Testimonial",
    `id, quote, quote_ar, author, author_ar, "authorTitle", "authorTitle_ar", "isPublished"`,
  );

  const ingredientFamilies = await rows<IngredientFamilySeedRow>(
    client,
    "IngredientFamily",
    `name, label_ar`,
    '"sortOrder", name',
  );

  const ingredientRows = await rows<
    Omit<IngredientSeedRow, "usedIn" | "image"> & {
      imageUrl: string;
      imageAlt: string;
      imageAlt_ar: string | null;
    }
  >(
    client,
    "Ingredient",
    `id, name, name_ar, slug, "latinName", origin, origin_ar,
     families::text[] as families, rarity, rarity_ar, "priceTier",
     description, description_ar, facts, facts_ar,
     "imageUrl", "imageAlt", "imageAlt_ar"`,
  );

  const usages = await rows<{
    ingredientId: string;
    productSlug: string;
    name: string;
  }>(
    client,
    "IngredientUsage",
    `"ingredientId", "productSlug", name`,
    '"ingredientId", "sortOrder", id',
  );

  const usedIn = new Map<string, { name: string; slug: string }[]>();
  for (const usage of usages) {
    const list = usedIn.get(usage.ingredientId) ?? [];
    list.push({ name: usage.name, slug: usage.productSlug });
    usedIn.set(usage.ingredientId, list);
  }

  const articles = await rows<ArticleSeedRow & {
    imageUrl: string;
    imageAlt: string;
    imageAlt_ar: string | null;
  }>(
    client,
    "Article",
    `id, slug, title, title_ar, category, category_ar, excerpt, excerpt_ar,
     body, body_ar, to_char("publishedAt", 'YYYY-MM-DD') as "publishedAt",
     "readTimeMinutes", "isFeatured", "isPublished",
     "imageUrl", "imageAlt", "imageAlt_ar"`,
    '"publishedAt" desc, id',
  );

  const timeline = await rows<TimelineEventSeedRow>(
    client,
    "TimelineEvent",
    `id, year, year_ar, title, title_ar, description, description_ar`,
  );

  const brandValues = await rows<BrandValueSeedRow>(
    client,
    "BrandValue",
    `id, title, title_ar, description, description_ar`,
  );

  const missionStatements = await rows<MissionStatementSeedRow>(
    client,
    "MissionStatement",
    `id, label, label_ar, title, title_ar, text, text_ar`,
  );

  const craftPillars = await rows<CraftPillarSeedRow>(
    client,
    "CraftPillar",
    `id, number, title, title_ar, description, description_ar`,
  );

  const craftStepRows = await rows<Omit<CraftStepSeedRow, "image"> & {
    imageUrl: string;
    imageAlt: string;
    imageAlt_ar: string | null;
  }>(
    client,
    "CraftStep",
    `id, number, title, title_ar, subtitle, subtitle_ar, body, body_ar,
     "imageUrl", "imageAlt", "imageAlt_ar"`,
  );

  const craftStats = await rows<CraftStatSeedRow>(
    client,
    "CraftStat",
    `id, value, value_ar, label, label_ar`,
  );

  const craftQuotes = await rows<CraftQuoteSeedRow>(
    client,
    "CraftQuote",
    `id, quote, quote_ar, author, author_ar, "authorTitle", "authorTitle_ar", "isPublished"`,
  );

  return {
    testimonials: testimonials.map((row) => ({
      id: row.id,
      quote: row.quote,
      quote_ar: row.quote_ar,
      author: row.author,
      author_ar: row.author_ar,
      authorTitle: row.authorTitle,
      authorTitle_ar: row.authorTitle_ar,
      isPublished: row.isPublished,
    })),
    ingredientFamilies: ingredientFamilies.map((row) => ({
      name: row.name,
      label_ar: row.label_ar,
    })),
    ingredients: ingredientRows.map((row) => ({
      id: row.id,
      name: row.name,
      name_ar: row.name_ar,
      slug: row.slug,
      latinName: row.latinName,
      origin: row.origin,
      origin_ar: row.origin_ar,
      families: row.families,
      rarity: row.rarity,
      rarity_ar: row.rarity_ar,
      priceTier: row.priceTier,
      description: row.description,
      description_ar: row.description_ar,
      // Ordered by the join's own `sortOrder`, so the detail panel lists the
      // perfumes in the order the atelier chose.
      usedIn: usedIn.get(row.id) ?? [],
      facts: row.facts,
      facts_ar: row.facts_ar,
      image: { url: row.imageUrl, alt: row.imageAlt, alt_ar: row.imageAlt_ar },
    })),
    articles: articles.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      title_ar: row.title_ar,
      category: row.category,
      category_ar: row.category_ar,
      excerpt: row.excerpt,
      excerpt_ar: row.excerpt_ar,
      body: row.body,
      body_ar: row.body_ar,
      publishedAt: row.publishedAt,
      readTimeMinutes: row.readTimeMinutes,
      isFeatured: row.isFeatured,
      isPublished: row.isPublished,
      image: { url: row.imageUrl, alt: row.imageAlt, alt_ar: row.imageAlt_ar },
    })),
    timeline: timeline.map((row) => ({
      id: row.id,
      year: row.year,
      year_ar: row.year_ar,
      title: row.title,
      title_ar: row.title_ar,
      description: row.description,
      description_ar: row.description_ar,
    })),
    brandValues: brandValues.map((row) => ({
      id: row.id,
      title: row.title,
      title_ar: row.title_ar,
      description: row.description,
      description_ar: row.description_ar,
    })),
    missionStatements: missionStatements.map((row) => ({
      id: row.id,
      label: row.label,
      label_ar: row.label_ar,
      title: row.title,
      title_ar: row.title_ar,
      text: row.text,
      text_ar: row.text_ar,
    })),
    craftPillars: craftPillars.map((row) => ({
      id: row.id,
      number: row.number,
      title: row.title,
      title_ar: row.title_ar,
      description: row.description,
      description_ar: row.description_ar,
    })),
    craftSteps: craftStepRows.map((row) => ({
      id: row.id,
      number: row.number,
      title: row.title,
      title_ar: row.title_ar,
      subtitle: row.subtitle,
      subtitle_ar: row.subtitle_ar,
      body: row.body,
      body_ar: row.body_ar,
      image: { url: row.imageUrl, alt: row.imageAlt, alt_ar: row.imageAlt_ar },
    })),
    craftStats: craftStats.map((row) => ({
      id: row.id,
      value: row.value,
      value_ar: row.value_ar,
      label: row.label,
      label_ar: row.label_ar,
    })),
    // At most one, by construction — the atelier has one house statement.
    craftQuote: craftQuotes[0]
      ? {
          id: craftQuotes[0].id,
          quote: craftQuotes[0].quote,
          quote_ar: craftQuotes[0].quote_ar,
          author: craftQuotes[0].author,
          author_ar: craftQuotes[0].author_ar,
          authorTitle: craftQuotes[0].authorTitle,
          authorTitle_ar: craftQuotes[0].authorTitle_ar,
          isPublished: craftQuotes[0].isPublished,
        }
      : null,
  };
}

async function readDirectory(client: Client): Promise<DirectorySeed> {
  const stockists = await rows<Omit<StockistSeedRow, "image"> & {
    imageUrl: string;
    imageAlt: string;
    imageAlt_ar: string | null;
  }>(
    client,
    "Stockist",
    `id, name, name_ar, city, city_ar, country, country_ar,
     region::text as region, type::text as type, status::text as status,
     address, address_ar, phone, "phoneHref", hours, hours_ar, "mapsUrl",
     "isPublished", "imageUrl", "imageAlt", "imageAlt_ar"`,
  );

  const contactChannels = await rows<ContactChannelSeedRow>(
    client,
    "ContactChannel",
    `id, label, label_ar, value, value_ar, href`,
  );

  const socialProfiles = await rows<{
    id: string;
    platform: string;
    handle: string;
    url: string;
  }>(client, "SocialProfile", `id, platform, handle, url`);

  const enquirySubjects = await rows<EnquirySubjectSeedRow>(
    client,
    "EnquirySubject",
    `label, label_ar`,
    '"sortOrder", label',
  );

  const legalDocuments = await rows<Omit<LegalDocumentSeedRow, "banner"> & {
    bannerUrl: string;
    bannerAlt: string;
    bannerAlt_ar: string | null;
  }>(
    client,
    "LegalDocument",
    `slug, eyebrow, eyebrow_ar, title, title_ar, lede, lede_ar,
     to_char("updatedAt", 'YYYY-MM-DD') as "updatedAt",
     "bannerUrl", "bannerAlt", "bannerAlt_ar", "contactEmail",
     sections, sections_ar`,
    '"sortOrder", slug',
  );

  const settingRows = await rows<{
    houseEmail: string;
    conciergeEmail: string;
    wholesaleEmail: string;
  }>(
    client,
    "BoutiqueSetting",
    `"houseEmail", "conciergeEmail", "wholesaleEmail"`,
    "id",
  );

  const settings = settingRows[0];

  if (!settings) {
    throw new Error(
      "No BoutiqueSetting row, so there are no house addresses to export.",
    );
  }

  return {
    stockists: stockists.map((row) => ({
      id: row.id,
      name: row.name,
      name_ar: row.name_ar,
      city: row.city,
      city_ar: row.city_ar,
      country: row.country,
      country_ar: row.country_ar,
      region: row.region,
      type: row.type,
      status: row.status,
      address: row.address,
      address_ar: row.address_ar,
      phone: row.phone,
      phoneHref: row.phoneHref,
      hours: row.hours,
      hours_ar: row.hours_ar,
      mapsUrl: row.mapsUrl,
      isPublished: row.isPublished,
      image: { url: row.imageUrl, alt: row.imageAlt, alt_ar: row.imageAlt_ar },
    })),
    contactChannels: contactChannels.map((row) => ({
      id: row.id,
      label: row.label,
      label_ar: row.label_ar,
      value: row.value,
      value_ar: row.value_ar,
      href: row.href,
    })),
    socialProfiles: socialProfiles.map((row) => ({
      id: row.id,
      platform: row.platform,
      handle: row.handle,
      url: row.url,
    })),
    enquirySubjects: enquirySubjects.map((row) => ({
      label: row.label,
      label_ar: row.label_ar,
    })),
    settings: {
      houseEmail: settings.houseEmail,
      conciergeEmail: settings.conciergeEmail,
      wholesaleEmail: settings.wholesaleEmail,
    },
    legalDocuments: legalDocuments.map((row) => ({
      slug: row.slug,
      eyebrow: row.eyebrow,
      eyebrow_ar: row.eyebrow_ar,
      title: row.title,
      title_ar: row.title_ar,
      lede: row.lede,
      lede_ar: row.lede_ar,
      updatedAt: row.updatedAt,
      // jsonb: the driver has already parsed it into objects.
      banner: {
        url: row.bannerUrl,
        alt: row.bannerAlt,
        alt_ar: row.bannerAlt_ar,
      },
      contactEmail: row.contactEmail,
      sections: row.sections,
      sections_ar: row.sections_ar,
    })),
  };
}

/** Write one seed file, formatted the way the committed files already are. */
async function writeSeed(name: string, value: unknown): Promise<void> {
  await writeFile(
    path.join(SEED_DIR, name),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

async function main(): Promise<void> {
  console.log(`Dumping ${redactUrl(connectionString())}`);

  const { catalog, content, directory } = await withClient(async (client) => ({
    catalog: await readCatalog(client),
    content: await readContent(client),
    directory: await readDirectory(client),
  }));

  await writeSeed("catalog.json", catalog);
  await writeSeed("content.json", content);
  await writeSeed("directory.json", directory);

  const images = catalog.products.reduce(
    (total, product) => total + product.images.length,
    0,
  );

  const counts: [string, number][] = [
    ["Collection", catalog.collections.length],
    ["Product", catalog.products.length],
    ["ProductImage", images],
    ["Testimonial", content.testimonials.length],
    ["IngredientFamily", content.ingredientFamilies.length],
    ["Ingredient", content.ingredients.length],
    ["Article", content.articles.length],
    ["TimelineEvent", content.timeline.length],
    ["BrandValue", content.brandValues.length],
    ["MissionStatement", content.missionStatements.length],
    ["CraftPillar", content.craftPillars.length],
    ["CraftStep", content.craftSteps.length],
    ["CraftStat", content.craftStats.length],
    ["CraftQuote", content.craftQuote ? 1 : 0],
    ["Stockist", directory.stockists.length],
    ["ContactChannel", directory.contactChannels.length],
    ["SocialProfile", directory.socialProfiles.length],
    ["EnquirySubject", directory.enquirySubjects.length],
    ["LegalDocument", directory.legalDocuments.length],
  ];

  for (const [table, count] of counts) {
    console.log(`  ${String(count).padStart(4)}  ${table}`);
  }

  console.log(
    "Wrote supabase/seed/{catalog,content,directory}.json. " +
      "Review `git diff` before committing.",
  );
}

main().catch((cause: unknown) => {
  console.error(
    `Dump failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
  );
  process.exitCode = 1;
});
