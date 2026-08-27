/**
 * Product URLs.
 *
 * The one place a catalog record becomes a link, and the reason adding a detail
 * page for a whole category of goods was the single-line change this header
 * used to promise it would be.
 *
 * Two page shapes, two URL spaces. A fragrance opens on `/perfume/[slug]` — a
 * pyramid, an ingredient list, a scent-ranked rail. Body care and home
 * fragrance open on `/ritual/[slug]` — three photographs, three captions, a
 * story. Neither route will render the other's goods (see `RITUAL_KINDS` in
 * `src/services/products.ts`), so the split is enforced at the query and not
 * just here.
 *
 * The discovery and gift sets still have no page of their own: they sell a
 * boxed composition straight from `<DiscoverySetCard>`, so a cart
 * line for one links back to the grid it came from.
 */

import type { CollectionKind } from "@/src/types/catalog";

/** The minimum a product must expose to be linked. */
export interface LinkableProduct {
  slug: string;
  collectionKind: CollectionKind;
}

/**
 * Category landing page for the kinds that sell from the grid.
 *
 * Both live under `/collections/[slug]` since the category routes were folded
 * in; the old top-level paths remain only as 308s.
 *
 * Body care and home fragrance are no longer here — they have `/ritual/[slug]`
 * now. Their collection pages are unchanged and still the place to browse them;
 * what changed is where a single *product* points.
 */
const CATEGORY_PATH = {
  DISCOVERY: "/collections/discovery",
  GIFT: "/collections/gift-set",
} as const satisfies Record<Extract<CollectionKind, "DISCOVERY" | "GIFT">, string>;

/**
 * Where a product's own page lives, as a locale-agnostic app path —
 * `<LocaleLink>` prefixes it.
 *
 * The `switch` is exhaustive against `CollectionKind`: a fifth kind fails to
 * compile here instead of silently falling through to a dead link.
 */
export function productHref(product: LinkableProduct): string {
  switch (product.collectionKind) {
    case "FRAGRANCE":
      return `/perfume/${product.slug}`;
    case "BODY":
    case "HOME":
      return `/ritual/${product.slug}`;
    case "DISCOVERY":
    case "GIFT":
      return CATEGORY_PATH[product.collectionKind];
    default: {
      const unreachable: never = product.collectionKind;
      return unreachable;
    }
  }
}

/**
 * True when a product has a detail page of its own.
 *
 * Written against the two kinds that do *not* rather than the three that do:
 * the sets are the exception now, and stating the exception is what makes a
 * sixth kind default to having a page — which is the safer wrong answer, since
 * a missing page 404s loudly and a page nothing links to is invisible.
 */
export function hasDetailPage(product: LinkableProduct): boolean {
  return (
    product.collectionKind !== "DISCOVERY" && product.collectionKind !== "GIFT"
  );
}

/**
 * The customer portal's routes, as locale-agnostic app paths.
 *
 * Written once so the sidebar, the `aria-current` comparison, and the proxy's
 * protected matcher cannot drift apart. `<LocaleLink>` adds the prefix; these
 * values never carry one.
 */
export const ACCOUNT_PATHS = {
  overview: "/account",
  profile: "/account/profile",
  orders: "/account/orders",
  addresses: "/account/addresses",
  vouchers: "/account/vouchers",
  notifications: "/account/notifications",
  preferences: "/account/preferences",
} as const;

/**
 * The dashboard's root, as a locale-agnostic app path.
 *
 * Written once so `src/proxy.ts`'s early shed, `AdminShell`'s rail, and
 * `robots.ts`'s disallow list all mean the same thing by "/admin". Everything
 * beneath it is reached by string concatenation from here.
 */
export const ADMIN_PATH = "/admin";

/**
 * Auth routes.
 *
 * These are also what `<ClerkProvider signInUrl>` is built from in the locale
 * layout — via `localizePath`, since Clerk needs the real prefixed URL rather
 * than the app path.
 */
export const AUTH_PATHS = {
  signIn: "/sign-in",
  signUp: "/sign-up",
} as const;
