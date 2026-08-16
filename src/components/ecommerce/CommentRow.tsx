import { formatCommentDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
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
 * It holds no state and calls no hook, which is what makes that dual use legal.
 *
 * The body is rendered as text — React escapes it. No markdown, no
 * auto-linking, no `dangerouslySetInnerHTML`: this is the one place in the app
 * where a stranger's writing reaches another visitor's screen.
 */

export interface CommentRowProps {
  comment: ProductComment;
  /** Translated fallback shown when the author was not signed in. */
  guestLabel: string;
  locale: Locale;
}

export default function CommentRow({
  comment,
  guestLabel,
  locale,
}: CommentRowProps) {
  return (
    <article className="border-t border-border py-7">
      <header className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-heading text-[11px] uppercase tracking-[0.2em] text-gold">
          {comment.authorName ?? guestLabel}
        </span>
        <time
          dateTime={comment.createdAt}
          className="text-[11px] tracking-wide text-ivory/35"
          {...ltrIsland(locale)}
        >
          {formatCommentDate(comment.createdAt, locale)}
        </time>
      </header>

      <p className="whitespace-pre-line text-[13px] leading-relaxed text-ivory/70">
        {comment.body}
      </p>
    </article>
  );
}
