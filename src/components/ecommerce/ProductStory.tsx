import type { LtrIsland } from "@/src/lib/i18n/rtl";

/**
 * The editorial story block on a product detail page — Server Component.
 *
 * Paragraphs are `\n\n`-separated in the `story` column and split here rather
 * than stored as HTML: the copy is data, and data never reaches
 * `dangerouslySetInnerHTML`.
 *
 * A product with no story renders no section at all — the page guards, so this
 * component never receives an empty string.
 */

export interface ProductStoryProps {
  story: string;
  heading: string;
  /** Set on the Arabic tree; the story itself stays English. */
  island: LtrIsland;
}

export default function ProductStory({
  story,
  heading,
  island,
}: ProductStoryProps) {
  const paragraphs = story.split("\n\n");

  return (
    <section>
      <h2 className="eyebrow mb-5">{heading}</h2>

      <div {...island}>
        {paragraphs.map((paragraph) => (
          <p
            key={paragraph.slice(0, 48)}
            className="mb-4 text-sm leading-loose text-ivory/55 last:mb-0"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
