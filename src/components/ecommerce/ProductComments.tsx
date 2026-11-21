import CommentForm from "@/src/components/ecommerce/CommentForm";
import CommentRow from "@/src/components/ecommerce/CommentRow";
import RatingSummary from "@/src/components/ecommerce/RatingSummary";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/src/lib/supabase";
import {
  getCommentsForProduct,
  getProductRatingSummary,
} from "@/src/services/comments";

/**
 * Visitor reflections on a fragrance — Server Component.
 *
 * Open to everyone: a signed-in visitor comments under their account name, a
 * signed-out one under "Guest". The distinction is drawn server-side in
 * `actions/comments.ts`; nothing here decides who anybody is.
 *
 * Two absences are deliberate:
 *
 * 1. **No empty state.** With no comments the section is the heading and the
 *    form, full stop — no "be the first to comment" panel, no placeholder
 *    block, and no gap where a list would sit. Same discipline as
 *    `<ProductIngredients>`, which returns `null` rather than render a heading
 *    over nothing.
 * 3. **No empty rating block.** `<RatingSummary>` returns `null` until the
 *    first star is left, for the same reason — an average of nothing is not a
 *    thing to show.
 *
 * 2. **No section at all when the database is unconfigured.** A form that
 *    cannot store anything must never be shown, and a checkout without
 *    Supabase credentials still builds and renders this page exactly as before.
 */

export interface ProductCommentsProps {
  slug: string;
  locale: Locale;
}

export default async function ProductComments({
  slug,
  locale,
}: ProductCommentsProps) {
  if (!isSupabaseConfigured()) return null;

  const [dict, comments, ratings] = await Promise.all([
    getDictionary(locale),
    getCommentsForProduct(slug),
    getProductRatingSummary(slug),
  ]);

  const copy = dict.product.comments;

  /*
   * `id="comments"` is a real destination: the day-after feedback email links
   * here, and so does the rating beside the product title.
   */
  return (
    <section
      id="comments"
      className="scroll-mt-20 px-4 pt-8 md:scroll-mt-32 md:px-10 md:pt-16 lg:px-12"
    >
      <div className="mx-auto max-w-200">
        <h2 className="eyebrow mb-3">{copy.eyebrow}</h2>
        <CommentForm
          slug={slug}
          locale={locale}
          guestLabel={copy.guest}
          storedIds={comments.map((comment) => comment.id)}
          summary={<RatingSummary summary={ratings} locale={locale} copy={copy} />}
        />

        {comments.length > 0 ? (
          <div className="mt-4 flex flex-col gap-3">
            {comments.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                guestLabel={copy.guest}
                ratingOutOfLabel={copy.ratingOutOf}
                locale={locale}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
