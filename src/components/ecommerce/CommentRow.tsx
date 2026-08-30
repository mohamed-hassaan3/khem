import CommentLightbox from "@/src/components/ecommerce/CommentLightbox";
import StarRating from "@/src/components/ecommerce/StarRating";
import { formatCommentDate, formatRating } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { ProductComment } from "@/src/types/comments";

/**
 * One comment in the thread.
 *
 * Carries no directive on purpose: it is rendered on the server inside
 * `<ProductComments>` for stored comments, and on the client inside
 * `<CommentForm>` for one the visitor has just posted. Two call sites, one
 * piece of markup, so an optimistic row can never drift from a stored one.
 *
 * It holds no state and calls no hook, which is what makes that dual use legal
 * — and why the photographs, which need an open/closed dialog, are delegated
 * whole to `<CommentLightbox>` rather than half-rendered here.
 *
 * A row carries a rating, a body, or both; the database refuses one with
 * neither. Each part is therefore rendered only if present, and the row never
 * collapses to nothing.
 *
 * The body is rendered as text — React escapes it. No markdown, no
 * auto-linking, no `dangerouslySetInnerHTML`: this is the one place in the app
 * where a stranger's writing reaches another visitor's screen.
 */

export interface CommentRowProps {
  comment: ProductComment;
  /** Translated fallback shown when the author was not signed in. */
  guestLabel: string;
  /** Translated "{rating} out of 5", for the star row's accessible name. */
  ratingOutOfLabel: string;
  locale: Locale;
}

export default function CommentRow({
  comment,
  guestLabel,
  ratingOutOfLabel,
  locale,
}: CommentRowProps) {
  const authorLabel = comment.authorName ?? guestLabel;

  return (
    <article className="border-t border-ground-border py-7">
      <header className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-heading text-[11px] uppercase tracking-[0.2em] text-ground-accent">
          {authorLabel}
        </span>

        {comment.rating !== null ? (
          <StarRating
            value={comment.rating}
            label={interpolate(ratingOutOfLabel, {
              rating: formatRating(comment.rating, locale),
            })}
            size={12}
            className="translate-y-0.5"
          />
        ) : null}

        <time
          dateTime={comment.createdAt}
          className="text-[11px] tracking-wide text-ground-muted"
          {...ltrIsland(locale)}
        >
          {formatCommentDate(comment.createdAt, locale)}
        </time>
      </header>

      {comment.body ? (
        <p className="whitespace-pre-line text-[13px] leading-relaxed text-ground-muted">
          {comment.body}
        </p>
      ) : null}

      {comment.images.length > 0 ? (
        <CommentLightbox
          images={comment.images}
          authorLabel={authorLabel}
          body={comment.body}
          createdAt={comment.createdAt}
          locale={locale}
        />
      ) : null}
    </article>
  );
}
