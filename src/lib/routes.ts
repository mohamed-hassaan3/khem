/**
 * Product URLs.
 *
 * The one place a catalog record becomes a link. Fragrances have a detail page;
 * body care, home fragrance, and discovery sets do not — they are sold straight
 * from their category grid, so a cart or wishlist line for one of those links
 * back to the grid it came from rather than to a `/perfume/…` URL that would
 * 404.
 *
 * Keeping this in one function is what makes adding a detail page for those
 * goods later a single-line change.
 */

import type { CollectionKind } from "@/src/types/catalog";

/** The minimum a product must expose to be linked. */
export interface LinkableProduct {
  slug: string;
  collectionKind: CollectionKind;
}

/** Category landing page for each non-fragrance kind. */
const CATEGORY_PATH = {
  BODY: "/body-care",
  HOME: "/room-fragrance",
  DISCOVERY: "/discovery",
  GIFT: "/gift-set",
} as const satisfies Record<Exclude<CollectionKind, "FRAGRANCE">, string>;

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
    case "DISCOVERY":
    case "GIFT":
      return CATEGORY_PATH[product.collectionKind];
    default: {
      const unreachable: never = product.collectionKind;
      return unreachable;
    }
  }
}

/** True when a product has a detail page of its own. */
export function hasDetailPage(product: LinkableProduct): boolean {
  return product.collectionKind === "FRAGRANCE";
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
  orders: "/account/orders",
  addresses: "/account/addresses",
  profile: "/account/profile",
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
