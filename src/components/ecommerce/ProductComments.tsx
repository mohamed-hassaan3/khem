import Reveal from "@/src/components/animation/Reveal";
import CommentForm from "@/src/components/ecommerce/CommentForm";
import CommentRow from "@/src/components/ecommerce/CommentRow";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/src/lib/supabase";
import { getCommentsForProduct } from "@/src/services/comments";

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

  const [dict, comments] = await Promise.all([
    getDictionary(locale),
    getCommentsForProduct(slug),
  ]);

  const copy = dict.product.comments;

  return (
    <section className="border-t border-border px-6 py-24 md:px-20 md:py-32">
      <div className="mx-auto max-w-200">
        <Reveal className="mb-12">
          <p className="eyebrow mb-4">{copy.eyebrow}</p>
          <h2 className="font-heading text-3xl font-normal text-ivory sm:text-4xl">
            {copy.heading}
          </h2>
        </Reveal>

        <CommentForm
          slug={slug}
          locale={locale}
          guestLabel={copy.guest}
          /*
           * The ids already rendered below. The action revalidates this path,
           * so a comment the visitor just posted normally arrives in the
           * refreshed server list — and the form drops its own copy of any id
           * it finds here. That is what keeps "instant feedback" from becoming
           * "the same comment twice".
           */
          storedIds={comments.map((comment) => comment.id)}
        />

        {comments.length > 0 ? (
          <div className="mt-14">
            {comments.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                guestLabel={copy.guest}
                locale={locale}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
