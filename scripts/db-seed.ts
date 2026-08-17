/**
 * Load `supabase/seed/*.json` into Postgres.
 *
 *     npm run db:seed
 *
 * ## What the JSON is
 *
 * The frozen contents of what used to be `src/data/` — the catalog, the
 * editorial content, the directory. It is a **data export, not application
 * code**: nothing under `src/` imports it, the running app cannot read it, and
 * Postgres is the only thing the UI queries. It exists so a fresh Supabase
 * project (a preview branch, a restored backup, a new environment) can be
 * rebuilt with two commands instead of by hand.
 *
 * Editing content means editing the database — the Supabase table editor, or a
 * future admin surface. If you want the export to match again afterwards, dump
 * it back; do not treat these files as the source of truth.
 *
 * ## Safety
 *
 * - Everything runs in **one transaction**: either the whole catalog lands or
 *   none of it does.
 * - Every row is an upsert keyed on the primary key, so re-running converges
 *   rather than duplicating.
 * - **Additive only.** No `drop`, no `truncate`, no `delete`. A record removed
 *   from the JSON is not removed from the database — unpublish or delete it
 *   deliberately, so this script can never quietly erase live content.
 * - Every value travels as a bound parameter. Nothing is interpolated into SQL:
 *   this data is editorial prose full of apostrophes, and it is injection-proof
 *   by construction rather than by escaping.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Client } from "pg";

import { ENQUIRY_SUBJECTS } from "../src/constants/contact";
import type { Collection, Product } from "../src/types/catalog";
import type {
  BrandValue,
  CraftPillar,
  CraftQuote,
  CraftStat,
  CraftStep,
  Ingredient,
  JournalArticle,
  MissionStatement,
  Testimonial,
  TimelineEvent,
} from "../src/types/content";
import type { LegalDocument } from "../src/types/legal";
import type { Stockist } from "../src/types/stockist";
import type { ContactChannel, SocialProfile } from "../src/types/contact";
import { redactUrl, connectionString, withTransaction } from "./db";

const SEED_DIR = path.join(process.cwd(), "supabase", "seed");

/**
 * The Arabic twin of every translatable column, as it appears in the seed JSON.
 *
 * The app types (`Collection`, `Product`, …) describe a record the UI has
 * already *resolved* to one language, so they carry no `_ar` fields — that is
 * the whole point of resolving in `src/schemas/db/*`. The seed file is the
 * other side of that boundary: it holds both languages, and these intersections
 * are where the difference is stated instead of being cast away.
 *
 * `null` is meaningful and is written through as `null`: it records "this field
 * is deliberately untranslated" (a Latin proper noun), which is what
 * `resolveText()` reads to fall back.
 */
type CollectionSeedRow = Collection & {
  name_ar: string | null;
  description_ar: string | null;
  bannerAlt_ar: string | null;
};

type ProductSeedRow = Omit<Product, "images"> & {
  subtitle_ar: string | null;
  description_ar: string | null;
  story_ar: string | null;
  format_ar: string | null;
  badge_ar: string | null;
  includes_ar: string[] | null;
  topNotes_ar: string[] | null;
  heartNotes_ar: string[] | null;
  baseNotes_ar: string[] | null;
  images: {
    url: string;
    alt: string;
    alt_ar: string | null;
    isPrimary: boolean;
    sortOrder: number;
  }[];
};

interface CatalogSeed {
  collections: CollectionSeedRow[];
  products: ProductSeedRow[];
  featuredProductSlug: string;
}

interface ContentSeed {
  testimonials: Testimonial[];
  ingredientFamilies: string[];
  ingredients: Ingredient[];
  articles: JournalArticle[];
  timeline: TimelineEvent[];
  brandValues: BrandValue[];
  missionStatements: MissionStatement[];
  craftPillars: CraftPillar[];
  craftSteps: CraftStep[];
  craftStats: CraftStat[];
  craftQuote: CraftQuote | null;
}

type StockistSeedRow = Omit<Stockist, "image"> & {
  name_ar: string | null;
  city_ar: string | null;
  country_ar: string | null;
  address_ar: string | null;
  hours_ar: string | null;
  image: { url: string; alt: string; alt_ar: string | null };
};

type ContactChannelSeedRow = ContactChannel & {
  label_ar: string | null;
  value_ar: string | null;
};

type LegalDocumentSeedRow = Omit<LegalDocument, "banner"> & {
  eyebrow_ar: string | null;
  title_ar: string | null;
  lede_ar: string | null;
  sections_ar: LegalDocument["sections"] | null;
  banner: { url: string; alt: string; alt_ar: string | null };
};

interface DirectorySeed {
  stockists: StockistSeedRow[];
  contactChannels: ContactChannelSeedRow[];
  socialProfiles: SocialProfile[];
  enquirySubjects: string[];
  settings: {
    houseEmail: string;
    conciergeEmail: string;
    wholesaleEmail: string;
  };
  legalDocuments: LegalDocumentSeedRow[];
}

async function readSeed<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(SEED_DIR, name), "utf8")) as T;
}

/** A column value as it goes to the driver. */
type Value = string | number | boolean | null | readonly string[];

type Row = Record<string, Value>;

/** Running tally, printed at the end. Counts, never contents. */
const written = new Map<string, number>();

/**
 * Upsert rows into `table`, keyed on `conflict`.
 *
 * One multi-row `insert … on conflict do update`, all values bound. Column
 * names come from the first row's keys — they are literals in this file, never
 * input — and are quoted, because the schema is camelCase.
 */
async function upsert(
  client: Client,
  table: string,
  conflict: string,
  rows: readonly Row[],
): Promise<void> {
  if (rows.length === 0) return;

  const columns = Object.keys(rows[0]);
  const quoted = columns.map((column) => `"${column}"`).join(", ");

  const values: Value[] = [];
  const tuples = rows.map((row) => {
    const placeholders = columns.map((column) => {
      values.push(row[column] ?? null);
      return `$${values.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });

  const updates = columns
    .filter((column) => column !== conflict)
    .map((column) => `"${column}" = excluded."${column}"`)
    .join(", ");

  await client.query(
    `insert into public."${table}" (${quoted}) values ${tuples.join(", ")}
       on conflict ("${conflict}") do update set ${updates}`,
    values,
  );

  written.set(table, rows.length);
}

/** `sortOrder` is array position: the seed arrays are curated running order. */
function ordered<T>(items: readonly T[], map: (item: T, index: number) => Row): Row[] {
  return items.map((item, index) => map(item, index));
}

async function seedCatalog(client: Client, seed: CatalogSeed): Promise<void> {
  await upsert(
    client,
    "Collection",
    "id",
    ordered(seed.collections, (collection, index) => ({
      id: collection.id,
      name: collection.name,
      name_ar: collection.name_ar,
      slug: collection.slug,
      description: collection.description,
      description_ar: collection.description_ar,
      bannerUrl: collection.bannerUrl,
      bannerAlt: collection.bannerAlt,
      bannerAlt_ar: collection.bannerAlt_ar,
      isFeatured: collection.isFeatured,
      kind: collection.kind,
      sortOrder: index,
    })),
  );

  await upsert(
    client,
    "Product",
    "id",
    ordered(seed.products, (product, index) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      subtitle: product.subtitle,
      subtitle_ar: product.subtitle_ar,
      description: product.description,
      description_ar: product.description_ar,
      story: product.story,
      story_ar: product.story_ar,
      concentration: product.concentration,
      format: product.format,
      format_ar: product.format_ar,
      includes: product.includes,
      includes_ar: product.includes_ar,
      badge: product.badge,
      badge_ar: product.badge_ar,
      tags: product.tags,
      topNotes: product.topNotes,
      topNotes_ar: product.topNotes_ar,
      heartNotes: product.heartNotes,
      heartNotes_ar: product.heartNotes_ar,
      baseNotes: product.baseNotes,
      baseNotes_ar: product.baseNotes_ar,
      volumeMl: product.volumeMl,
      priceInCents: product.priceInCents,
      sku: product.sku,
      inventory: product.inventory,
      isBestseller: product.isBestseller,
      collectionSlug: product.collectionSlug,
      sortOrder: index,
    })),
  );

  await upsert(
    client,
    "ProductImage",
    "id",
    seed.products.flatMap((product) =>
      product.images.map((image, index) => ({
        // Deterministic, so re-seeding updates the same row rather than
        // appending a second copy of the same photograph.
        id: `${product.slug}-image-${index}`,
        productSlug: product.slug,
        url: image.url,
        alt: image.alt,
        alt_ar: image.alt_ar,
        isPrimary: image.isPrimary,
        sortOrder: image.sortOrder,
      })),
    ),
  );
}

async function seedContent(client: Client, seed: ContentSeed): Promise<void> {
  await upsert(
    client,
    "Testimonial",
    "id",
    ordered(seed.testimonials, (testimonial, index) => ({
      id: testimonial.id,
      quote: testimonial.quote,
      author: testimonial.author,
      authorTitle: testimonial.authorTitle,
      isPublished: true,
      sortOrder: index,
    })),
  );

  // Before the ingredients: the trigger on `"Ingredient"` rejects a family that
  // is not in this vocabulary.
  await upsert(
    client,
    "IngredientFamily",
    "name",
    ordered(seed.ingredientFamilies, (name, index) => ({
      name,
      sortOrder: index,
    })),
  );

  await upsert(
    client,
    "Ingredient",
    "id",
    ordered(seed.ingredients, (ingredient, index) => ({
      id: ingredient.id,
      name: ingredient.name,
      slug: ingredient.slug,
      latinName: ingredient.latinName,
      origin: ingredient.origin,
      families: ingredient.families,
      rarity: ingredient.rarity,
      priceTier: ingredient.priceTier,
      description: ingredient.description,
      facts: ingredient.facts,
      imageUrl: ingredient.image.url,
      imageAlt: ingredient.image.alt,
      sortOrder: index,
    })),
  );

  await upsert(
    client,
    "IngredientUsage",
    "id",
    seed.ingredients.flatMap((ingredient) =>
      ingredient.usedIn.map((usage, index) => ({
        id: `${ingredient.id}-${usage.slug}`,
        ingredientId: ingredient.id,
        productSlug: usage.slug,
        name: usage.name,
        sortOrder: index,
      })),
    ),
  );

  await upsert(
    client,
    "Article",
    "id",
    seed.articles.map((article) => ({
      id: article.id,
      slug: article.slug,
      title: article.title,
      category: article.category,
      excerpt: article.excerpt,
      body: article.body,
      publishedAt: article.publishedAt,
      readTimeMinutes: article.readTimeMinutes,
      isFeatured: article.isFeatured,
      isPublished: true,
      imageUrl: article.image.url,
      imageAlt: article.image.alt,
    })),
  );

  await upsert(
    client,
    "TimelineEvent",
    "id",
    ordered(seed.timeline, (event, index) => ({
      id: event.id,
      year: event.year,
      title: event.title,
      description: event.description,
      sortOrder: index,
    })),
  );

  await upsert(
    client,
    "BrandValue",
    "id",
    ordered(seed.brandValues, (value, index) => ({
      id: value.id,
      title: value.title,
      description: value.description,
      sortOrder: index,
    })),
  );

  await upsert(
    client,
    "MissionStatement",
    "id",
    ordered(seed.missionStatements, (statement, index) => ({
      id: statement.id,
      label: statement.label,
      title: statement.title,
      text: statement.text,
      sortOrder: index,
    })),
  );

  await upsert(
    client,
    "CraftPillar",
    "id",
    ordered(seed.craftPillars, (pillar, index) => ({
      id: pillar.id,
      number: pillar.number,
      title: pillar.title,
      description: pillar.description,
      sortOrder: index,
    })),
  );

  await upsert(
    client,
    "CraftStep",
    "id",
    ordered(seed.craftSteps, (step, index) => ({
      id: step.id,
      number: step.number,
      title: step.title,
      subtitle: step.subtitle,
      body: step.body,
      imageUrl: step.image.url,
      imageAlt: step.image.alt,
      sortOrder: index,
    })),
  );

  await upsert(
    client,
    "CraftStat",
    "id",
    ordered(seed.craftStats, (stat, index) => ({
      id: stat.id,
      value: stat.value,
      label: stat.label,
      sortOrder: index,
    })),
  );

  if (seed.craftQuote) {
    await upsert(client, "CraftQuote", "id", [
      {
        id: seed.craftQuote.id,
        quote: seed.craftQuote.quote,
        author: seed.craftQuote.author,
        authorTitle: seed.craftQuote.authorTitle,
        isPublished: true,
        sortOrder: 0,
      },
    ]);
  }
}

async function seedDirectory(
  client: Client,
  seed: DirectorySeed,
  featuredProductSlug: string,
): Promise<void> {
  await upsert(
    client,
    "Stockist",
    "id",
    ordered(seed.stockists, (stockist, index) => ({
      id: stockist.id,
      name: stockist.name,
      name_ar: stockist.name_ar,
      city: stockist.city,
      city_ar: stockist.city_ar,
      country: stockist.country,
      country_ar: stockist.country_ar,
      region: stockist.region,
      type: stockist.type,
      status: stockist.status,
      address: stockist.address,
      address_ar: stockist.address_ar,
      phone: stockist.phone,
      phoneHref: stockist.phoneHref,
      hours: stockist.hours,
      hours_ar: stockist.hours_ar,
      mapsUrl: stockist.mapsUrl,
      imageUrl: stockist.image.url,
      imageAlt: stockist.image.alt,
      imageAlt_ar: stockist.image.alt_ar,
      isPublished: true,
      sortOrder: index,
    })),
  );

  await upsert(
    client,
    "ContactChannel",
    "id",
    ordered(seed.contactChannels, (channel, index) => ({
      id: channel.id,
      label: channel.label,
      label_ar: channel.label_ar,
      value: channel.value,
      value_ar: channel.value_ar,
      href: channel.href,
      sortOrder: index,
    })),
  );

  await upsert(
    client,
    "SocialProfile",
    "id",
    ordered(seed.socialProfiles, (profile, index) => ({
      id: profile.id,
      platform: profile.platform,
      handle: profile.handle,
      url: profile.url,
      sortOrder: index,
    })),
  );

  /*
   * Seeded from the constant, not from the JSON: `src/schemas/contact.ts`
   * validates a submitted subject against `ENQUIRY_SUBJECTS`, so the table has
   * to be a copy of that list rather than a second, independently editable one.
   */
  await upsert(
    client,
    "EnquirySubject",
    "label",
    ordered(ENQUIRY_SUBJECTS, (label, index) => ({ label, sortOrder: index })),
  );

  await upsert(client, "BoutiqueSetting", "id", [
    {
      id: "default",
      houseEmail: seed.settings.houseEmail,
      conciergeEmail: seed.settings.conciergeEmail,
      wholesaleEmail: seed.settings.wholesaleEmail,
      featuredProductSlug,
    },
  ]);

  await upsert(
    client,
    "LegalDocument",
    "slug",
    ordered(seed.legalDocuments, (document, index) => ({
      slug: document.slug,
      eyebrow: document.eyebrow,
      eyebrow_ar: document.eyebrow_ar,
      title: document.title,
      title_ar: document.title_ar,
      lede: document.lede,
      lede_ar: document.lede_ar,
      updatedAt: document.updatedAt,
      bannerUrl: document.banner.url,
      bannerAlt: document.banner.alt,
      bannerAlt_ar: document.banner.alt_ar,
      // jsonb: the driver sends the string, Postgres parses and validates it.
      sections: JSON.stringify(document.sections),
      // Null stays null rather than becoming the string "null": an
      // untranslated policy must fall back to the English sections.
      sections_ar: document.sections_ar
        ? JSON.stringify(document.sections_ar)
        : null,
      contactEmail: document.contactEmail,
      sortOrder: index,
    })),
  );
}

async function main(): Promise<void> {
  const catalog = await readSeed<CatalogSeed>("catalog.json");
  const content = await readSeed<ContentSeed>("content.json");
  const directory = await readSeed<DirectorySeed>("directory.json");

  console.log(`Seeding ${redactUrl(connectionString())}`);

  await withTransaction(async (client) => {
    await seedCatalog(client, catalog);
    await seedContent(client, content);
    await seedDirectory(client, directory, catalog.featuredProductSlug);
  });

  for (const [table, count] of written) {
    console.log(`  ${String(count).padStart(4)}  ${table}`);
  }
  console.log("Seed complete.");
}

main().catch((cause: unknown) => {
  console.error(
    `Seed failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
  );
  process.exitCode = 1;
});
