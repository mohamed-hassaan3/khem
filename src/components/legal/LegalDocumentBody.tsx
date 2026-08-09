import Link from "next/link";

import Reveal from "@/src/components/animation/Reveal";
import type { LegalBlock, LegalDocument } from "@/src/types/legal";

/**
 * Document renderer shared by the four legal routes.
 *
 * Server Component. The contents index is pure anchors and CSS `sticky` — no
 * scroll-spy, no client boundary of its own.
 *
 * Every block is rendered from the `LegalBlock` union, so no policy copy ever
 * reaches `dangerouslySetInnerHTML`.
 */

/**
 * Stagger between sections, in seconds. Smaller than the 0.1 used on the
 * editorial pages: legal sections are dense and stack closely, so a long
 * stagger reads as lag rather than choreography.
 */
const SECTION_STAGGER = 0.06;

/** Two-digit section index, e.g. 0 → "01". */
function sectionNumeral(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function LegalBlockView({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "text":
      return (
        <p className="mb-5 text-sm leading-loose text-ivory/50">{block.text}</p>
      );

    case "list":
      return (
        <ul className="mb-6 flex flex-col gap-3.5">
          {block.items.map((item) => (
            <li
              key={item}
              className="flex gap-4 text-sm leading-loose text-ivory/50"
            >
              {/* Gold hairline instead of a bullet — matches `.gold-line`. */}
              <span
                aria-hidden="true"
                className="mt-2.5 h-px w-4 flex-none bg-gold/40"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    case "link":
      return (
        <p className="mb-5 text-sm leading-loose text-ivory/50">
          {block.text}{" "}
          <Link
            href={block.href}
            className="text-gold underline decoration-gold/30 underline-offset-4 transition-colors duration-300 hover:decoration-gold"
          >
            {block.label}
          </Link>
        </p>
      );

    case "note":
      return (
        <aside className="mb-6 border-l-2 border-gold bg-surface/60 px-6 py-5 text-sm leading-loose text-ivory/70">
          {block.text}
        </aside>
      );

    case "table":
      // Wide content scrolls inside its own container; the page body never does.
      return (
        <div className="mb-6 overflow-x-auto">
          <table className="w-full min-w-125 border-collapse text-left">
            <thead>
              <tr>
                {block.table.head.map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="border-b border-border pb-3 pr-6 font-body text-[10px] font-medium uppercase tracking-[0.2em] text-gold/60"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.table.rows.map(([label, value]) => (
                <tr key={label}>
                  <th
                    scope="row"
                    className="border-b border-border py-4 pr-6 align-top text-[13px] font-normal leading-relaxed text-ivory/80"
                  >
                    {label}
                  </th>
                  <td className="border-b border-border py-4 pr-6 align-top text-[13px] leading-relaxed text-ivory/50">
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export type LegalDocumentBodyProps = Pick<
  LegalDocument,
  "sections" | "contactEmail"
>;

export default function LegalDocumentBody({
  sections,
  contactEmail,
}: LegalDocumentBodyProps) {
  return (
    <div className="mx-auto max-w-350 px-6 py-20 md:px-20 md:py-28">
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[260px_1fr] lg:gap-24">
        {/* ── CONTENTS INDEX ──────────────────────── */}
        <nav
          aria-label="Contents"
          className="hidden self-start lg:sticky lg:top-30 lg:block"
        >
          <p className="eyebrow mb-7">Contents</p>
          <ol className="flex flex-col">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex gap-4 border-b border-border py-3 no-underline transition-colors duration-300 hover:text-gold"
                >
                  <span className="flex-none font-heading text-[10px] leading-5 tracking-widest text-gold/40">
                    {sectionNumeral(index)}
                  </span>
                  <span className="text-xs leading-5 text-ivory/45 transition-colors duration-300 hover:text-gold">
                    {section.title}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* ── DOCUMENT ────────────────────────────── */}
        <article>
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="mb-14 scroll-mt-30 border-t border-border pt-12 first:border-t-0 first:pt-0"
            >
              <Reveal delay={index * SECTION_STAGGER}>
                <p className="mb-4 font-heading text-[10px] tracking-[0.25em] text-gold/40">
                  {sectionNumeral(index)}
                </p>
                <h2 className="mb-8 font-heading text-xl font-normal leading-snug text-ivory sm:text-2xl">
                  {section.title}
                </h2>

                {section.blocks.map((block, blockIndex) => (
                  <LegalBlockView
                    key={`${section.id}-${blockIndex}`}
                    block={block}
                  />
                ))}
              </Reveal>
            </section>
          ))}

          {/* ── QUESTIONS ─────────────────────────── */}
          <Reveal className="border border-border bg-surface p-10 md:p-12">
            <p className="eyebrow mb-6">Questions</p>
            <p className="mb-7 max-w-md text-[13px] leading-loose text-ivory/45">
              If anything on this page is unclear, write to us. We would rather
              explain it than have you guess.
            </p>
            <a href={`mailto:${contactEmail}`} className="btn-luxury inline-flex">
              Email Us
            </a>
          </Reveal>
        </article>
      </div>
    </div>
  );
}
