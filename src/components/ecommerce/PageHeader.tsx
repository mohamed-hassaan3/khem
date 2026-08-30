/**
 * The bar a utility page opens on — eyebrow, title, and an optional count line.
 *
 * Used by `/cart`, the utility route that begins on a rule rather than a hero.
 * Editorial routes keep their full-bleed heroes; this is deliberately the
 * quieter opening.
 *
 * Every string here is dictionary copy, translated in both trees — so unlike
 * the product blocks below it, nothing on this bar is wrapped in an LTR island.
 */

export interface PageHeaderProps {
  eyebrow: string;
  heading: string;
  /** Item count line, already interpolated. Omitted when the page is empty. */
  meta?: string;
  /** Renders `meta` inside a polite live region, for counts that change. */
  metaLive?: boolean;
  /**
   * Direction for the heading alone.
   *
   * `/search` puts visitor-typed text of unknown script in this slot, where
   * `"auto"` lets an English query keep its LTR run inside the Arabic page.
   * Dictionary headings leave it unset and inherit the page direction.
   */
  headingDir?: "auto";
}

export default function PageHeader({
  eyebrow,
  heading,
  meta,
  metaLive = false,
  headingDir,
}: PageHeaderProps) {
  return (
    <header className="border-b border-ground-border px-4 pb-10 pt-14 sm:px-8 lg:px-14 lg:pb-12 lg:pt-16 xl:px-20">
      <p className="eyebrow mb-3">{eyebrow}</p>

      <h1
        dir={headingDir}
        className="font-heading text-3xl font-normal text-ground sm:text-4xl lg:text-5xl"
      >
        {heading}
      </h1>

      {meta ? (
        <p
          {...(metaLive ? { "aria-live": "polite" as const } : {})}
          className="mt-3 text-xs tracking-[0.08em] text-ground-muted"
        >
          {meta}
        </p>
      ) : null}
    </header>
  );
}
