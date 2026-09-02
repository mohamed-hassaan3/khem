/**
 * The shape of `supabase/seed/catalog.json`, shared by the two scripts that
 * stand on either side of it.
 *
 *   `db-dump.ts`  writes this file from Postgres.
 *   `db-seed.ts`  reads it back into Postgres.
 *
 * They only round-trip if they agree on the shape, and stating it once here
 * makes that agreement a compile error rather than a convention: adding an
 * `_ar` column to the dump without teaching the seeder to write it stops the
 * build instead of quietly dropping a translation on the next fresh project.
 *
 * ## Why these types are not the app types
 *
 * `Collection` and `Product` in `src/types/catalog.ts` describe a record the UI
 * has already **resolved** to one language — that is the whole point of
 * resolving in `src/schemas/db/*`. The seed file is the other side of that
 * boundary: it holds both languages, and the intersections below are where the
 * difference is stated instead of being cast away.
 *
 * `null` is meaningful and is written through as `null`: it records "this field
 * is deliberately untranslated" (a Latin proper noun), which is what
 * `resolveText()` reads to fall back.
 */

import type { Collection, Product } from "../src/types/catalog";
import type { ContactChannel, SocialProfile } from "../src/types/contact";
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

/**
 * `cardUrl` / `cardAlt` are omitted from the app type and restated as
 * nullable: `Collection` exposes them already fallen back to the banner, which
 * is a resolved value and not a column. The seed carries the column, so it
 * carries `null` for a collection with no card crop of its own.
 */
export type CollectionSeedRow = Omit<Collection, "cardUrl" | "cardAlt"> & {
  name_ar: string | null;
  description_ar: string | null;
  bannerAlt_ar: string | null;
  cardUrl: string | null;
  cardAlt: string | null;
  cardAlt_ar: string | null;
};

/** One photograph, as the file carries it. */
export interface ProductImageSeedRow {
  url: string;
  alt: string;
  alt_ar: string | null;
  /** The triptych line — `0013_product_image_caption.sql`. */
  caption: string | null;
  caption_ar: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

/*
 * `promotion` is omitted along with `images`: it is not a column on `"Product"`
 * at all but a join onto `active_product_promotions`, attached at read time by
 * `src/services/products.ts`. A campaign is not seed data — it is something the
 * desk starts and stops — so a dump that carried one would restore last
 * November's prices onto a fresh database.
 */
export type ProductSeedRow = Omit<Product, "images" | "promotion"> & {
  subtitle_ar: string | null;
  description_ar: string | null;
  story_ar: string | null;
  format_ar: string | null;
  badge_ar: string | null;
  includes_ar: string[] | null;
  topNotes_ar: string[] | null;
  heartNotes_ar: string[] | null;
  baseNotes_ar: string[] | null;
  /*
   * The typed product kind. Declared here rather than on `Product` because the
   * storefront never reads it off a product object — it is a *filter*, applied
   * in `getProductCardsByProductType()` — so adding it to the app's type would
   * oblige every card and detail parse to carry a field none of them uses.
   */
  productType: "BODY_MIST" | "ROOM_SPRAY" | null;
  /*
   * The two stock counters. `inventory` on the base `Product` type is the
   * trigger-maintained total and is not what the seeder writes — see
   * `scripts/db-seed.ts`.
   */
  inventoryOnline: number;
  inventoryOffline: number;
  images: ProductImageSeedRow[];
};

/**
 * `supabase/seed/catalog.json` in full.
 *
 * Array order is load-bearing on both sides: it *is* the `"sortOrder"` column,
 * which is why neither row type carries that field. The dumper orders by it,
 * the seeder writes the array index back.
 */
export interface CatalogSeed {
  collections: CollectionSeedRow[];
  products: ProductSeedRow[];
  featuredProductSlug: string;
}

/*
 * ── Editorial content ───────────────────────────────────────
 *
 * `content.json`. Same rule as the catalog: the app types in
 * `src/types/content.ts` are already resolved to one language, so every
 * translatable column is restated here with its `_ar` twin.
 *
 * `isPublished` is carried too, on the three tables that have it. The seeder
 * used to hard-code it to `true`, which meant unpublishing a testimonial in the
 * dashboard survived exactly until the next `db:seed` put it back on the home
 * page. It is a column, so it belongs in the export.
 */

export type TestimonialSeedRow = Testimonial & {
  quote_ar: string | null;
  author_ar: string | null;
  authorTitle_ar: string | null;
  isPublished: boolean;
};

/** The olfactive vocabulary, and its display order, as one row per family. */
export interface IngredientFamilySeedRow {
  name: string;
  label_ar: string | null;
}

export type IngredientSeedRow = Omit<Ingredient, "image" | "usedIn"> & {
  /*
   * The `"IngredientUsage"` row as stored, not as rendered. `IngredientUsage`
   * in `types/content.ts` also carries the product's `collectionKind`, which is
   * what the "Found in" links are built from — it is read through the FK at
   * query time and lives in `"Collection"`, so dumping it here would write a
   * derived value into the seed and let it go stale against the table it came
   * from.
   */
  usedIn: { name: string; slug: string }[];
  name_ar: string | null;
  origin_ar: string | null;
  rarity_ar: string | null;
  description_ar: string | null;
  facts_ar: string[] | null;
  image: { url: string; alt: string; alt_ar: string | null };
};

export type ArticleSeedRow = Omit<JournalArticle, "image"> & {
  title_ar: string | null;
  category_ar: string | null;
  excerpt_ar: string | null;
  body_ar: string | null;
  isPublished: boolean;
  image: { url: string; alt: string; alt_ar: string | null };
};

export type TimelineEventSeedRow = TimelineEvent & {
  year_ar: string | null;
  title_ar: string | null;
  description_ar: string | null;
};

export type BrandValueSeedRow = BrandValue & {
  title_ar: string | null;
  description_ar: string | null;
};

export type MissionStatementSeedRow = MissionStatement & {
  label_ar: string | null;
  title_ar: string | null;
  text_ar: string | null;
};

export type CraftPillarSeedRow = CraftPillar & {
  title_ar: string | null;
  description_ar: string | null;
};

export type CraftStepSeedRow = Omit<CraftStep, "image"> & {
  title_ar: string | null;
  subtitle_ar: string | null;
  body_ar: string | null;
  image: { url: string; alt: string; alt_ar: string | null };
};

export type CraftStatSeedRow = CraftStat & {
  value_ar: string | null;
  label_ar: string | null;
};

export type CraftQuoteSeedRow = CraftQuote & {
  quote_ar: string | null;
  author_ar: string | null;
  authorTitle_ar: string | null;
  isPublished: boolean;
};

export interface ContentSeed {
  testimonials: TestimonialSeedRow[];
  ingredientFamilies: IngredientFamilySeedRow[];
  ingredients: IngredientSeedRow[];
  articles: ArticleSeedRow[];
  timeline: TimelineEventSeedRow[];
  brandValues: BrandValueSeedRow[];
  missionStatements: MissionStatementSeedRow[];
  craftPillars: CraftPillarSeedRow[];
  craftSteps: CraftStepSeedRow[];
  craftStats: CraftStatSeedRow[];
  craftQuote: CraftQuoteSeedRow | null;
}

/*
 * ── Directory ───────────────────────────────────────────────
 *
 * `directory.json` — the stockists, the contact details, the legal documents.
 */

export type StockistSeedRow = Omit<Stockist, "image"> & {
  name_ar: string | null;
  city_ar: string | null;
  country_ar: string | null;
  address_ar: string | null;
  hours_ar: string | null;
  isPublished: boolean;
  image: { url: string; alt: string; alt_ar: string | null };
};

export type ContactChannelSeedRow = ContactChannel & {
  label_ar: string | null;
  value_ar: string | null;
};

/**
 * An enquiry subject and its translation.
 *
 * Which labels exist is *not* editable in Supabase: `src/schemas/contact.ts`
 * validates a submitted subject against the `ENQUIRY_SUBJECTS` constant, so the
 * table is a projection of that list and the seeder keeps writing it from the
 * constant. `label_ar` has no such constraint and is edited on the platform
 * like any other translation, which is why this is a row and not a string.
 */
export interface EnquirySubjectSeedRow {
  label: string;
  label_ar: string | null;
}

export type LegalDocumentSeedRow = Omit<LegalDocument, "banner"> & {
  eyebrow_ar: string | null;
  title_ar: string | null;
  lede_ar: string | null;
  sections_ar: LegalDocument["sections"] | null;
  banner: { url: string; alt: string; alt_ar: string | null };
};

export interface DirectorySeed {
  stockists: StockistSeedRow[];
  contactChannels: ContactChannelSeedRow[];
  socialProfiles: SocialProfile[];
  enquirySubjects: EnquirySubjectSeedRow[];
  settings: {
    houseEmail: string;
    conciergeEmail: string;
    wholesaleEmail: string;
  };
  legalDocuments: LegalDocumentSeedRow[];
}
