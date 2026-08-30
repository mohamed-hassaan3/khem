/**
 * Product URLs.
 *
 * The one place a catalog record becomes a link, and the reason adding a detail
 * page for a whole category of goods was the single-line change this header
 * used to promise it would be.
 *
 * Three page shapes, three URL spaces. A fragrance opens on `/perfume/[slug]` —
 * a pyramid, an ingredient list, a scent-ranked rail. Body care and home
 * fragrance open on `/ritual/[slug]` — three photographs, three captions, a
 * story. Discovery and gift sets open on `/set/[slug]` — a boxed composition
 * and the list of what is in it.
 *
 * No route will render another's goods (see `RITUAL_KINDS` and `SET_KINDS` in
 * `src/services/products.ts`), so each split is enforced at the query and not
 * just here.
 *
 * Every kind now has a page. The sets were the exception until `/set/[slug]`
 * landed — before that a set card was not a link at all and a cart line for one
 * pointed back at the grid it came from.
 */

import type { CollectionKind } from "@/src/types/catalog";

/** The minimum a product must expose to be linked. */
export interface LinkableProduct {
  slug: string;
  collectionKind: CollectionKind;
}

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
      return `/set/${product.slug}`;
    default: {
      const unreachable: never = product.collectionKind;
      return unreachable;
    }
  }
}

/**
 * True when a product has a detail page of its own.
 *
 * Every kind does, since the sets gained `/set/[slug]` — so this returns `true`
 * five times. It is kept, and kept as an exhaustive `switch` rather than a bare
 * `return true`, for the reason `productHref()` is one: a sixth kind fails to
 * compile here and has to state whether it has a page, instead of silently
 * inheriting `true` and shipping a link to a route that 404s.
 *
 * It is also the readable half of a pair with `DETAIL_PAGE_KINDS` in
 * `src/services/products.ts`, which asks the same question of the database.
 * The two must agree; this is the one a call site can read.
 */
export function hasDetailPage(product: LinkableProduct): boolean {
  switch (product.collectionKind) {
    case "FRAGRANCE":
    case "BODY":
    case "HOME":
    case "DISCOVERY":
    case "GIFT":
      return true;
    default: {
      const unreachable: never = product.collectionKind;
      return unreachable;
    }
  }
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
