/**
 * Choosing the sentence a refused discount code shows.
 *
 * ## Why this is a module and not four lines in `DiscountStep`
 *
 * The same refusal now reaches a customer from two places — the code field,
 * where `previewDiscount` answers, and the payment button, where `place_order()`
 * raises — and the whole point of the work in
 * `supabase/sql/0040_discount_refusal_detail.sql` is that those two say the same
 * thing. Two call sites picking their own sentence would be two chances to
 * disagree.
 *
 * ## It decides nothing about the code
 *
 * Every fact rendered here — the minimum, the eligible collections, the count of
 * the rest — arrived from `resolve_discount()`. This function selects a template
 * and fills it in. It does not know what a discount is, and it must never learn:
 * a minimum recomputed in TypeScript is a second definition of the offer.
 *
 * ## The absent detail is the normal case
 *
 * A grant-gated code carries none, most refusals have no specifics to carry, and
 * a database that has not applied `0040` sends none at all. Every branch falls
 * back to the plain sentence, which is why deploying this ahead of the migration
 * is uneventful.
 */

import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import type {
  DiscountPreview,
  DiscountRefusalDetail,
  DiscountRefusalName,
} from "@/src/types/discount";

type DiscountCopy = Dictionary["checkout"]["discount"];

/** What the client was told, minus the amount it would have saved. */
export type DiscountRefusal = Extract<DiscountPreview, { ok: false }>;

/**
 * One name, in the reader's language.
 *
 * `resolveText()`'s rule, applied to a value that arrives beside the row rather
 * than on it: Arabic when the row has one, English otherwise — never a blank
 * where a translation is missing. A fragrance name has no Arabic form by
 * design and so always takes the English branch.
 */
function readName(entry: DiscountRefusalName, locale: Locale): string {
  if (locale !== "ar") return entry.name;
  const arabic = entry.nameAr?.trim();
  return arabic ? arabic : entry.name;
}

/**
 * The names as prose.
 *
 * `Intl.ListFormat` rather than a separator from the dictionary, because "and"
 * versus "و" and where each sits is a fact about the language, not a decision
 * for a copywriter.
 */
function joinNames(names: readonly string[], locale: Locale): string {
  return new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  }).format(names);
}

/** The eligible-sets sentence, or null when there is nothing safe to name. */
function eligibleSentence(
  detail: DiscountRefusalDetail,
  copy: DiscountCopy,
  locale: Locale,
): string | null {
  const names = detail.names ?? [];
  if (detail.scope === undefined || names.length === 0) return null;

  const rendered = names.map((entry) => readName(entry, locale));
  const single = rendered.length === 1 && (detail.more ?? 0) === 0;

  const template =
    detail.scope === "COLLECTIONS"
      ? single
        ? copy.reasonDetail.COLLECTIONS_ONE
        : copy.reasonDetail.COLLECTIONS_MANY
      : single
        ? copy.reasonDetail.PRODUCTS_ONE
        : copy.reasonDetail.PRODUCTS_MANY;

  const sentence = interpolate(template, {
    names: joinNames(rendered, locale),
  });

  const more = detail.more ?? 0;
  return more > 0
    ? sentence + interpolate(copy.reasonDetail.andMore, { count: more })
    : sentence;
}

/**
 * The sentence to show for a refusal.
 *
 * `formatPrice` is passed in rather than imported so this stays a pure function
 * of its arguments — the caller already holds the visitor's currency through
 * `useFormatPrice()`, and a module that reached for it itself could not be
 * called from a Server Component.
 */
export function discountRefusalMessage(
  refusal: DiscountRefusal,
  copy: DiscountCopy,
  locale: Locale,
  formatPrice: (cents: number) => string,
): string {
  /*
   * A code this build cannot name: show the server's English sentence rather
   * than a generic apology. A newer migration's refusal is still true, and
   * English on the Arabic tree beats silence about the reason.
   */
  if (refusal.reasonCode === "UNKNOWN") return refusal.reason;

  const detail = refusal.detail;

  if (detail !== undefined) {
    if (
      refusal.reasonCode === "BELOW_MINIMUM" &&
      detail.minimumInCents !== undefined
    ) {
      return interpolate(copy.reasonDetail.BELOW_MINIMUM, {
        amount: formatPrice(detail.minimumInCents),
      });
    }

    if (refusal.reasonCode === "NOTHING_ELIGIBLE") {
      const sentence = eligibleSentence(detail, copy, locale);
      if (sentence !== null) return sentence;
    }
  }

  return copy.reason[refusal.reasonCode];
}
