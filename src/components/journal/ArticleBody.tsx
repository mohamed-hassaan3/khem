import Reveal from "@/src/components/animation/Reveal";
import type { Locale } from "@/src/lib/i18n/config";
import { parseArticleBody, parseInline } from "@/src/lib/journal/body";
import type { JournalArticle } from "@/src/types/content";

/**
 * The essay — Server Component.
 *
 * One measured column, nothing beside it. The page has a full-bleed banner and
 * a three-column rail below; between them the reader should have a single line
 * of sight and a comfortable measure, which is what `max-w-3xl` is doing here
 * rather than the `max-w-350` the rest of the site uses.
 *
 * Blocks come from `parseArticleBody()` and are rendered as **text nodes**.
 * There is no `dangerouslySetInnerHTML` on this route by design: the body is
 * editable from the admin dashboard, and markup stored in a database is markup
 * that eventually runs.
 */

export interface ArticleBodyProps {
  article: JournalArticle;
  locale: Locale;
}

/*
 * Logical properties throughout (`ms-`, `ps-`, `border-s`), so the drop cap and
 * the quote rule sit on the correct side under RTL without a second set of
 * `rtl:` overrides. The body copy itself is English and sits in an LTR island;
 * the *layout* around it still follows the page direction.
 */
const DROP_CAP =
  "first-letter:float-left first-letter:me-3 first-letter:mt-1 " +
  "first-letter:font-heading first-letter:text-6xl first-letter:leading-none " +
  "first-letter:text-ground-accent rtl:first-letter:float-right";

const PARAGRAPH = "mb-8 text-[15px] leading-[2] text-ground-muted";

/**
 * A block's text, with `*emphasis*` turned into `<em>`.
 *
 * Every segment is a text node — `<em>` is an element this component creates,
 * not markup the database supplied — so the no-`dangerouslySetInnerHTML` rule
 * on this route survives inline styling.
 */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((segment, index) =>
        segment.emphasis ? (
          <em key={index} className="italic text-ground">
            {segment.text}
          </em>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

export default function ArticleBody({ article }: ArticleBodyProps) {
  const blocks = parseArticleBody(article.body);

  // The drop cap belongs on the first *paragraph*, which is not necessarily the
  // first block — an essay may open on a subheading.
  const firstParagraph = blocks.findIndex((block) => block.kind === "paragraph");

  return (
    <section className="mx-auto max-w-3xl px-4 md:px-6 py-12 md:py-28" dir="auto">
      {/* ── LEAD ────────────────────────────────────── */}
      <Reveal>
        <p className="font-heading text-lg italic leading-relaxed text-ground-muted md:text-xl">
          <Inline text={article.excerpt} />
        </p>
        <div
          className="mt-6 md:mt-10 mb-8 md:mb-12 h-px w-full bg-linear-to-r from-gold/40 via-border to-transparent rtl:bg-linear-to-l"
          aria-hidden="true"
        />
      </Reveal>

      {/* ── BODY ────────────────────────────────────── */}
      {blocks.map((block, index) => {
        // Blocks are positional and have no id of their own; the index is the
        // only stable key here, and the list never reorders.
        const key = `${block.kind}-${index}`;

        if (block.kind === "heading") {
          return (
            <h2
              key={key}
              className="mt-10 md:mt-16 mb-6 font-heading text-xl font-normal leading-snug text-ground md:text-2xl"
            >
              <Inline text={block.text} />
            </h2>
          );
        }

        if (block.kind === "quote") {
          return (
            <blockquote
              key={key}
              className="my-8 md:my-14 border-s border-ground-accent/40 ps-8 font-heading text-xl italic leading-relaxed text-gold-soft md:text-2xl"
            >
              <Inline text={block.text} />
            </blockquote>
          );
        }

        return (
          <p
            key={key}
            className={
              index === firstParagraph ? `${PARAGRAPH} ${DROP_CAP}` : PARAGRAPH
            }
          >
            <Inline text={block.text} />
          </p>
        );
      })}
    </section>
  );
}
