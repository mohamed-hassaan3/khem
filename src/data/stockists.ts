/**
 * Local seed data for the stockist directory.
 *
 * Same contract as `contact.ts` and `content.ts`: the only place these values
 * are hardcoded, shaped for a straight insert into Supabase (or a CMS) later.
 *
 * Every surface that renders this array is written against its contents rather
 * than against a fixed count, so adding a record here is the whole change — the
 * region bar, the count line, the map chips, and the partner section all pick
 * it up with no code edit.
 *
 * Records carry a `status`: an announced location (`comingSoon`) has no contact
 * details, is excluded from the "locations worldwide" count and the retail
 * partner section, and renders as a non-interactive announcement.
 */

import type { Stockist, StockistRegion } from "@/src/types/stockist";

/**
 * Canonical region order for the filter bar.
 *
 * The bar renders the intersection of this list and the regions actually
 * present in `STOCKISTS`, so the taxonomy sets the order while the data sets
 * the membership — no permanently empty tabs.
 */
export const STOCKIST_REGIONS: StockistRegion[] = [
  "middleEast",
  "europe",
  "americas",
  "asiaPacific",
];

export const STOCKISTS: Stockist[] = [
  {
    id: "cairo-flagship",
    name: "KHEM Flagship Boutique",
    city: "Cairo",
    country: "Egypt",
    region: "middleEast",
    type: "flagship",
    status: "open",
    // Kept identical to the `boutique` channel in `contact.ts` — one boutique,
    // one address. If either moves, both move together.
    address: "New Cairo City, Cairo Governorate, Egypt.",
    phone: "+20 11 234 5678",
    phoneHref: "tel:+201123456789",
    hours: "Mon–Sat 10:00–20:00",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=KHEM+Flagship+Boutique+New+Cairo+City+Cairo+Governorate+Egypt",
    image: {
      url: "https://images.unsplash.com/photo-1747696766706-5485b39bf358?w=1200&h=800&fit=crop&auto=format",
      alt: "The KHEM flagship boutique interior, lit low against dark stone",
    },
  },
  {
    /*
     * Announced, not open. Every contact field is deliberately `null` — the
     * page reads `status` and renders this as a forthcoming location rather
     * than a destination, so nothing here is a placeholder waiting to be
     * displayed.
     *
     * Launching it is this record alone: fill in address / phone / phoneHref /
     * hours / mapsUrl and flip `status` to `"open"`. No component changes.
     */
    id: "dubai-boutique",
    name: "KHEM Dubai",
    city: "Dubai",
    country: "United Arab Emirates",
    region: "middleEast",
    type: "boutique",
    status: "comingSoon",
    address: null,
    phone: null,
    phoneHref: null,
    hours: null,
    mapsUrl: null,
    image: {
      url: "https://images.unsplash.com/photo-1709666414115-47ecd5143293?w=1200&h=800&fit=crop&auto=format",
      alt: "A darkened atelier interior awaiting its opening",
    },
  },
];

/** Address wholesale and partnership enquiries reach. Precedent: `CONCIERGE_EMAIL`. */
export const WHOLESALE_EMAIL = "wholesale@khemperfumes.com";
