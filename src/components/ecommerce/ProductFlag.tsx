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
 * every card spends the end corner on the add-to-bag control. Both insets are
 * logical, so the pair swaps sides together in Arabic and never collides.
 *
 * On phones the pill sits flush against that edge (`start-0`) and drops a type
 * size: at 375px the grid is two-up, a card is ~170px wide, and an inset pill
 * at desktop size ate the corner of the photograph it was meant to annotate.
 * Its own `px-3` keeps the text off the edge. From `sm` up the original inset
 * and size return.
 */
/**
 * Gold is the affirmative accent — a price, a call to action, a merchandiser's
 * claim. `"muted"` exists for the one label that is the opposite of a claim:
 * "Sold Out". Same geometry, same type, so the two pills occupy an identical
 * footprint and a card does not re-flow when a product runs out.
 */
const TONES = {
  gold: "bg-gold text-background",
  muted: "border border-white/10 bg-background/85 text-ivory/70 backdrop-blur-sm",
} as const;

export default function ProductFlag({
  label,
  locale,
  island = false,
  tone = "gold",
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
  /** See {@link TONES}. */
  tone?: keyof typeof TONES;
}) {
  return (
    <p
      {...(island ? ltrIsland(locale) : { dir: "auto" as const })}
      className={`absolute start-0 top-4 z-2 px-3 py-1.5 font-heading text-[8px] font-semibold tracking-[0.2em] sm:start-5 sm:top-5 sm:text-[9px] ${TONES[tone]}`}
    >
      {label}
    </p>
  );
}
