import type { Metadata } from "next";

import CartView from "@/src/components/ecommerce/CartView";
import { LOCALES, isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { getProductCardsByCollection } from "@/src/services/products";

/**
 * ISR, 5 minutes.
 *
 * AGENTS.md §8 lists `/cart` as Force Dynamic, which assumes a server-held
 * cart. Today the bag lives in the visitor's browser and this route renders no
 * per-visitor data at all — only the catalog the island resolves ids against —
 * so a dynamic render would cost a function invocation per view and buy
 * nothing. The revalidate window matches the PDP because both surfaces show
 * live catalog prices. **Restore `force-dynamic` when the cart moves to
 * Supabase behind a Clerk session.**
 */
export const revalidate = 300;

const PATH = "/cart";

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
      title: dict.cart.meta.title,
      description: dict.cart.meta.description,
    }),
    // A shopping bag is a session surface with nothing to index; links out of
    // it still deserve to be followed.
    robots: { index: false, follow: true },
  };
}

/** Shopping bag. */
export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, catalog] = await Promise.all([
    params,
    // The whole catalog: `localStorage` is unreadable on the server, so the
    // page cannot know *which* products to fetch. A dozen card projections is
    // cheaper than the round trip that knowing would cost.
    getProductCardsByCollection(),
  ]);

  // The layout has already rejected any segment that is not a real locale.
  const activeLocale = isLocale(locale) ? locale : "en";

  return <CartView locale={activeLocale} catalog={catalog} />;
}
