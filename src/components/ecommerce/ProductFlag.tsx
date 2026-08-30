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
 *
 * ## Why these are not ground-relative
 *
 * Every other component on a card moved onto the `--ground-*` variables when
 * the light half of the system landed. This one deliberately did not.
 *
 * A flag does not sit on the card's ground — it sits on the *photograph*, in
 * the corner of the image, and a photograph is not one of the five grounds. It
 * can be a pale flacon on stone or a black bottle on charcoal within the same
 * grid. Resolving these against the card's ground would tie the pill's colour
 * to a surface it never touches, and would make it illegible on exactly the
 * images that contrast most with their card.
 *
 * So the veil stays a fixed near-obsidian with a fixed blur, on every ground. It is legible over any image, which is the only requirement that
 * matters here.
 *
 * These values are deliberately *not* `--ground-*` and must not be "tidied"
 * into them. A mechanical sweep did exactly that once and had to be reverted:
 * on the ivory shop grid every muted flag became near-black text on a
 * near-black veil. That risk is higher now, not lower: the grid is ivory
 * everywhere.
 */
const TONES = {
  gold: "bg-gold text-background",
  muted:
    "border border-white/12 bg-background/85 text-ivory/70 backdrop-blur-sm",
  /*
   * A running campaign — "BLACK FRIDAY", "RAMADAN OFFER".
   *
   * Deliberately neither of the other two. Solid gold is the merchandiser's
   * claim about the product itself ("Most Popular"), and a sale is a claim about
   * the *price*; printing it in the same fill would make a discount read as an
   * endorsement and would put two solid gold pills on the same shelf. Obsidian
   * behind a gold hairline is the house's quieter register — the same treatment
   * the cart drawer and the modals use — and keeps the identical footprint, so
   * a card does not re-flow when a campaign starts.
   */
  campaign:
    "border border-gold/40 bg-background/85 text-gold backdrop-blur-sm",
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
