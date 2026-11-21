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
  /** False inside a `<ProductAccordion>`, whose summary is the heading. */
  showHeading?: boolean;
}

export default function ProductStory({
  story,
  heading,
  showHeading = true,
}: ProductStoryProps) {
  const paragraphs = story.split("\n\n");

  return (
    <section>
      {showHeading ? <h2 className="eyebrow mb-5">{heading}</h2> : null}

      {/* The story is translated. `dir="auto"` rather than a fixed
          direction, because an untranslated product falls back to the English
          story and only the rendered text can decide which way it runs. */}
      <div dir="auto">
        {paragraphs.map((paragraph) => (
          <p
            key={paragraph.slice(0, 48)}
            className="mb-3 text-sm leading-relaxed text-ground-muted last:mb-0 md:leading-loose"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
