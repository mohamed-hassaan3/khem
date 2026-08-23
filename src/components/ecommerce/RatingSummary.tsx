import StarRating from "@/src/components/ecommerce/StarRating";
import { formatCount, formatRating } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import type { ProductRatingSummary } from "@/src/types/comments";

/**
 * What the thread says before anybody reads it: the average, in stars.
 *
 * Renders `null` at zero ratings, the discipline `<ProductComments>` already
 * keeps for the thread itself — no "no ratings yet" panel, no empty star row
 * standing in for one. The first rating brings the block into being.
 *
 * Hook-free and directive-free, like `<StarRating>` and `<CommentRow>`: it is
 * server-rendered inside the section and needs nothing from the browser.
 */

export interface RatingSummaryProps {
  summary: ProductRatingSummary;
  locale: Locale;
  copy: {
    ratingOutOf: string;
    ratingSummaryLabel: string;
    ratingCount: string;
    ratingCountOne: string;
  };
}

export default function RatingSummary({
  summary,
  locale,
  copy,
}: RatingSummaryProps) {
  if (summary.count === 0) return null;

  const average = formatRating(summary.average, locale);

  return (
    <div
      className="mb-8 md:mb-12 flex items-center gap-5 border-s border-gold/30 ps-5"
      aria-label={copy.ratingSummaryLabel}
    >
      <span className="font-heading text-3xl leading-none tabular-nums text-gold">
        {average}
      </span>

      <div>
        <StarRating
          value={summary.average}
          label={interpolate(copy.ratingOutOf, { rating: average })}
          size={13}
          className="mb-1.5"
        />
        <p className="text-[11px] tracking-wide text-ivory/35">
          {summary.count === 1
            ? copy.ratingCountOne
            : interpolate(copy.ratingCount, {
                count: formatCount(summary.count, locale),
              })}
        </p>
      </div>
    </div>
  );
}
