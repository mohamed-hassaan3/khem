/**
 * Stockist and boutique-location types.
 *
 * Kept separate from `contact.ts` for the same reason `contact.ts` is separate
 * from `content.ts`: this is a distinct domain with no Prisma model in
 * AGENTS.md §9 yet. When it moves server-side it becomes a `Stockist` table —
 * the service layer absorbs it and nothing here changes.
 */

import type { ContentImage } from "@/src/types/content";

/**
 * The closed set of regions a stockist can belong to.
 *
 * A union rather than free-form strings: the filter bar and each record read
 * from the same vocabulary, so a typo must fail typecheck instead of silently
 * producing a region nothing can filter to. This is exactly the bug the
 * previous implementation had — it matched on hardcoded country-name arrays
 * and fell through to "show everything" for any region it had no list for.
 *
 * Display order lives in `STOCKIST_REGIONS` (`src/data/stockists.ts`); the
 * labels live in `dict.stockists.regions`, keyed by these members, so adding a
 * region without translating it is a compile error.
 */
export type StockistRegion =
  | "middleEast"
  | "europe"
  | "americas"
  | "asiaPacific";

/**
 * The badge vocabulary shown against each location.
 *
 * Same reasoning as {@link StockistRegion}: `flagship` is styled differently
 * from the rest, so the value must be a key the styling can switch on rather
 * than a display string. Labels live in `dict.stockists.types`.
 */
export type StockistType =
  | "flagship"
  | "boutique"
  | "retailPartner"
  | "departmentStore";

/**
 * Whether a location is trading today.
 *
 * An explicit field rather than something inferred from empty contact details:
 * "is this store open" is a fact about the store, and deriving it from whether
 * someone remembered to leave `phone` blank would let a data-entry slip
 * silently change how a real boutique renders.
 *
 * A `comingSoon` location has no contact details at all and renders as an
 * announcement, not a destination — it is excluded from the "locations
 * worldwide" count and from the retail-partner section, and its directory row
 * is not interactive.
 */
export type StockistStatus = "open" | "comingSoon";

export interface Stockist {
  /** Stable identity. Never key a list by city — two stores can share one. */
  id: string;
  name: string;
  city: string;
  country: string;
  region: StockistRegion;
  type: StockistType;
  status: StockistStatus;
  /**
   * Street address as displayed. English-only; rendered in an LTR island.
   * `null` on an announced location whose address is not public yet.
   */
  address: string | null;
  /** Display form, e.g. "+20 11 234 5678". `null` until the store opens. */
  phone: string | null;
  /**
   * `tel:` target — a leading `+` and digits only, no spaces. `null` until the
   * store opens.
   */
  phoneHref: string | null;
  /** Opening hours, e.g. "Mon–Sat 10:00–20:00". English-only. `null` until the store opens. */
  hours: string | null;
  /**
   * Absolute maps URL for this location, or `null` until the store opens.
   *
   * Stored rather than built at render time: a URL assembled from record
   * fields is a URL assembled from data that will one day come from a table,
   * and this way the link target is reviewable alongside the address it points
   * at.
   */
  mapsUrl: string | null;
  image: ContentImage;
}
