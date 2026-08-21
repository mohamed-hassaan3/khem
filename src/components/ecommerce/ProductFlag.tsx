import type { Locale } from "@/src/lib/i18n/config";
import { ltrIsland } from "@/src/lib/i18n/rtl";

/**
 * The gold pill in the corner of a product card.
 *
 * Presentational and hook-free on purpose: `<ProductCard>` is an async Server
 * Component and `<MerchCard>` / `<DiscoverySetCard>` are client ones, and all
 * three print the same badge. Whichever card renders it resolves the *label*
 * first — a product's free-text `badge`, else its merchandising flag — so this
 * component decides nothing about what a card says, only how it looks saying it.
 *
 * Placement is the inline-**start** corner across all three cards, because
 * `<MerchCard>` and `<DiscoverySetCard>` already spend the end corner on the
 * wishlist heart. Both insets are logical, so the pair swaps sides together in
 * Arabic and never collides.
 */
export default function ProductFlag({
  label,
  locale,
  island = false,
}: {
  label: string;
  locale: Locale;
  /**
   * `true` for a product's stored `badge`, which is English in both trees and
   * therefore needs a real LTR island. A translated label takes `dir="auto"`
   * instead: an untranslated row falls back to English, and only the rendered
   * text can decide which way it runs.
   */
  island?: boolean;
}) {
  return (
    <p
      {...(island ? ltrIsland(locale) : { dir: "auto" as const })}
      className="absolute start-5 top-5 z-2 bg-gold px-3 py-1.5 font-heading text-[9px] font-semibold tracking-[0.2em] text-background"
    >
      {label}
    </p>
  );
}
