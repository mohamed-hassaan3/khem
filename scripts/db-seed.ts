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
 * Editing content means editing the database — the Supabase table editor, or
 * the admin dashboard. Supabase is the source of truth; these files are not.
 * When you have edited content on the platform, run `npm run db:dump` to bring
 * the export back into line and commit the diff. `db-dump.ts` is the exact
 * inverse of this script for `catalog.json`.
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
import { redactUrl, connectionString, withTransaction } from "./db";
import type { CatalogSeed, ContentSeed, DirectorySeed } from "./seed-types";

const SEED_DIR = path.join(process.cwd(), "supabase", "seed");

/*
 * The shape of all three seed files — and the `_ar` twins the app types drop —
 * lives in `./seed-types`, because `db-dump.ts` writes the files this reads.
 */

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
      cardUrl: collection.cardUrl,
      cardAlt: collection.cardAlt,
      cardAlt_ar: collection.cardAlt_ar,
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
        caption: image.caption,
        caption_ar: image.caption_ar,
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
      quote_ar: testimonial.quote_ar,
      author: testimonial.author,
      author_ar: testimonial.author_ar,
      authorTitle: testimonial.authorTitle,
      authorTitle_ar: testimonial.authorTitle_ar,
      // Read from the export, not hard-coded: unpublishing a testimonial in the
      // dashboard used to survive only until the next seed put it back.
      isPublished: testimonial.isPublished,
      sortOrder: index,
    })),
  );

  // Before the ingredients: the trigger on `"Ingredient"` rejects a family that
  // is not in this vocabulary.
  await upsert(
    client,
    "IngredientFamily",
    "name",
    ordered(seed.ingredientFamilies, (family, index) => ({
      name: family.name,
      label_ar: family.label_ar,
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
      name_ar: ingredient.name_ar,
      slug: ingredient.slug,
      latinName: ingredient.latinName,
      origin: ingredient.origin,
      origin_ar: ingredient.origin_ar,
      families: ingredient.families,
      rarity: ingredient.rarity,
      rarity_ar: ingredient.rarity_ar,
      priceTier: ingredient.priceTier,
      description: ingredient.description,
      description_ar: ingredient.description_ar,
      facts: ingredient.facts,
      facts_ar: ingredient.facts_ar,
      imageUrl: ingredient.image.url,
      imageAlt: ingredient.image.alt,
      imageAlt_ar: ingredient.image.alt_ar,
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
      title_ar: article.title_ar,
      category: article.category,
      category_ar: article.category_ar,
      excerpt: article.excerpt,
      excerpt_ar: article.excerpt_ar,
      body: article.body,
      body_ar: article.body_ar,
      publishedAt: article.publishedAt,
      readTimeMinutes: article.readTimeMinutes,
      isFeatured: article.isFeatured,
      isPublished: article.isPublished,
      imageUrl: article.image.url,
      imageAlt: article.image.alt,
      imageAlt_ar: article.image.alt_ar,
    })),
  );

  await upsert(
    client,
    "TimelineEvent",
    "id",
    ordered(seed.timeline, (event, index) => ({
      id: event.id,
      year: event.year,
      year_ar: event.year_ar,
      title: event.title,
      title_ar: event.title_ar,
      description: event.description,
      description_ar: event.description_ar,
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
      title_ar: value.title_ar,
      description: value.description,
      description_ar: value.description_ar,
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
      label_ar: statement.label_ar,
      title: statement.title,
      title_ar: statement.title_ar,
      text: statement.text,
      text_ar: statement.text_ar,
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
      title_ar: pillar.title_ar,
      description: pillar.description,
      description_ar: pillar.description_ar,
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
      title_ar: step.title_ar,
      subtitle: step.subtitle,
      subtitle_ar: step.subtitle_ar,
      body: step.body,
      body_ar: step.body_ar,
      imageUrl: step.image.url,
      imageAlt: step.image.alt,
      imageAlt_ar: step.image.alt_ar,
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
      value_ar: stat.value_ar,
      label: stat.label,
      label_ar: stat.label_ar,
      sortOrder: index,
    })),
  );

  if (seed.craftQuote) {
    await upsert(client, "CraftQuote", "id", [
      {
        id: seed.craftQuote.id,
        quote: seed.craftQuote.quote,
        quote_ar: seed.craftQuote.quote_ar,
        author: seed.craftQuote.author,
        author_ar: seed.craftQuote.author_ar,
        authorTitle: seed.craftQuote.authorTitle,
        authorTitle_ar: seed.craftQuote.authorTitle_ar,
        isPublished: seed.craftQuote.isPublished,
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
      isPublished: stockist.isPublished,
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
   * *Which* subjects exist comes from the constant, not from the JSON:
   * `src/schemas/contact.ts` validates a submitted subject against
   * `ENQUIRY_SUBJECTS`, so the table has to be a copy of that list rather than a
   * second, independently editable one. A subject added in Supabase would be
   * rejected by the form it appears on.
   *
   * The *translation* has no such constraint — it is edited on the platform like
   * any other — so `label_ar` is carried over from the export by label.
   */
  const subjectTranslations = new Map(
    seed.enquirySubjects.map((subject) => [subject.label, subject.label_ar]),
  );

  await upsert(
    client,
    "EnquirySubject",
    "label",
    ordered(ENQUIRY_SUBJECTS, (label, index) => ({
      label,
      label_ar: subjectTranslations.get(label) ?? null,
      sortOrder: index,
    })),
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
