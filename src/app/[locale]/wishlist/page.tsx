import type { Metadata } from "next";

import WishlistView from "@/src/components/ecommerce/WishlistView";
import { LOCALES, isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { getProductCardsByCollection } from "@/src/services/products";

/**
 * ISR, 5 minutes.
 *
 * AGENTS.md §8 lists `/wishlist` as protected and dynamic. Clerk has since
 * landed and this route is still neither, deliberately: saved fragrances live
 * in the visitor's browser, so the route renders no per-visitor data on the
 * server, and requiring a session would lock guests out of a list their own
 * browser is holding. It is not in the protected matcher in `src/proxy.ts`.
 *
 * **Revisit when the `Wishlist` table lands** — at that point saves become
 * server state tied to a `userId`, and the §8 treatment becomes correct.
 */
export const revalidate = 300;

const PATH = "/wishlist";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  return {
    ...localeMetadata({
      locale: activeLocale,
      path: PATH,
      title: dict.wishlist.meta.title,
      description: dict.wishlist.meta.description,
    }),
    robots: { index: false, follow: true },
  };
}

/** Saved fragrances. */
export default async function WishlistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, catalog] = await Promise.all([
    params,
    getProductCardsByCollection(),
  ]);

  // The layout has already rejected any segment that is not a real locale.
  const activeLocale = isLocale(locale) ? locale : "en";

  return <WishlistView locale={activeLocale} catalog={catalog} />;
}
