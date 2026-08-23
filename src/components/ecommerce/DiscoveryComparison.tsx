import { Check, Minus } from "lucide-react";

import Reveal from "@/src/components/animation/Reveal";
import Price from "@/src/components/ecommerce/Price";
import { formatVolume } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * "Which set is right for you?" — Server Component.
 *
 * Every cell is **derived from the sets themselves**. The original SPA table
 * hardcoded three columns (`row.initiation`, `row.noir`, `row.complete`) in a
 * parallel array, so a fourth set would have been added to the grid above and
 * silently missing from the comparison below, and the two could drift apart on
 * any edit. Here the rows are computed, so the table is correct for one set or
 * for eight.
 *
 * Boolean cells are Lucide icons with a screen-reader label — the SPA printed a
 * bare `✓` / `—`, which a screen reader announces as "check mark" or as nothing
 * at all, leaving the row meaningless without sight of the column.
 */

export interface DiscoveryComparisonProps {
  sets: readonly ProductCardData[];
  locale: Locale;
}

/**
 * A cell is a printed string, a yes/no mark, or a price.
 *
 * Price is its own kind rather than a pre-formatted `text` cell because the
 * currency is not known at this point — it is resolved in the browser, after
 * hydration. The row therefore carries the stored USD cents and lets the
 * renderer decide how to say it, which keeps the data structure data.
 */
type Cell =
  | { kind: "text"; value: string }
  | { kind: "flag"; value: boolean }
  | { kind: "price"; value: number };

/** Does a set list something matching this pattern among its contents? */
function includesMatching(set: ProductCardData, pattern: RegExp): boolean {
  return set.includes.some((entry) => pattern.test(entry));
}

export default async function DiscoveryComparison({
  sets,
  locale,
}: DiscoveryComparisonProps) {
  const dict = await getDictionary(locale);
  const island = ltrIsland(locale);

  if (sets.length === 0) return null;

  const rows: ReadonlyArray<{ label: string; cells: Cell[] }> = [
    {
      label: dict.discovery.compare.rows.vials,
      cells: sets.map((set) => ({
        kind: "text" as const,
        value: set.format ?? "—",
      })),
    },
    {
      label: dict.discovery.compare.rows.volume,
      cells: sets.map((set) => ({
        kind: "text" as const,
        value: formatVolume(set.volumeMl),
      })),
    },
    {
      label: dict.discovery.compare.rows.box,
      cells: sets.map((set) => ({
        kind: "flag" as const,
        value: includesMatching(set, /box/i),
      })),
    },
    {
      label: dict.discovery.compare.rows.booklet,
      cells: sets.map((set) => ({
        kind: "flag" as const,
        value: includesMatching(set, /booklet/i),
      })),
    },
    {
      // The KHEM promise applies to every discovery purchase, by definition.
      label: dict.discovery.compare.rows.credit,
      cells: sets.map(() => ({ kind: "flag" as const, value: true })),
    },
    {
      label: dict.discovery.compare.rows.price,
      cells: sets.map((set) => ({
        kind: "price" as const,
        value: set.priceInCents,
      })),
    },
  ];

  return (
    <section className="border-t border-border bg-background px-4 py-14 md:px-20 md:py-30">
      <div className="mx-auto max-w-275">
        <Reveal className="mb-8 md:mb-14 text-center">
          <p className="eyebrow mb-4">{dict.discovery.compare.eyebrow}</p>
          <h2 className="font-heading text-3xl font-normal text-ivory sm:text-4xl">
            {dict.discovery.compare.heading}
          </h2>
        </Reveal>

        {/*
         * The table scrolls inside its own container; the page never does.
         *
         * `relative` is what makes that true, and it is not decoration. A table
         * is 560px wide at its narrowest (`min-w-140`), and a static scroll
         * container still propagates its content's layout overflow up the
         * containing-block chain — so on a phone the *document* measured 511px
         * against a 375px screen. The visible cost was the header: `<nav>` is
         * `fixed inset-x-0`, and a mobile browser widens the layout viewport to
         * cover overflowing content, so the bar stretched with it and left the
         * bag and account icons off the right edge, jumping as the page was
         * nudged sideways. Positioning the container makes it the containing
         * block, so the overflow stops here, where the scrollbar is.
         *
         * Measured, not assumed: with this class the document reports 375px on
         * a 375px screen; without it, 511px. Discovery was the only page in the
         * site with the symptom because it is the only page with this table.
         */}
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-140 border-collapse">
            <caption className="sr-only">
              {dict.discovery.compare.caption}
            </caption>

            <thead>
              <tr>
                <th className="border-b border-border px-6 py-5" />
                {sets.map((set) => (
                  <th
                    key={set.id}
                    scope="col"
                    className="border-b border-border px-6 py-5 text-center font-heading text-[13px] font-normal tracking-[0.1em] text-ivory"
                    {...island}
                  >
                    {set.name.replace(/^The /, "")}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  key={row.label}
                  className={rowIndex % 2 === 0 ? undefined : "bg-white/2"}
                >
                  <th
                    scope="row"
                    className="border-b border-border px-6 py-4 text-start text-xs font-normal tracking-wide text-ivory/40"
                  >
                    {row.label}
                  </th>

                  {row.cells.map((cell, cellIndex) => (
                    <td
                      key={sets[cellIndex].id}
                      className="border-b border-border px-6 py-4 text-center text-xs tracking-wide text-ivory"
                    >
                      {cell.kind === "text" ? (
                        <span {...island}>{cell.value}</span>
                      ) : cell.kind === "price" ? (
                        <span {...island}>
                          <Price cents={cell.value} />
                        </span>
                      ) : cell.value ? (
                        <>
                          <Check
                            size={14}
                            strokeWidth={1.25}
                            aria-hidden="true"
                            className="mx-auto text-gold"
                          />
                          <span className="sr-only">
                            {dict.discovery.compare.yes}
                          </span>
                        </>
                      ) : (
                        <>
                          <Minus
                            size={14}
                            strokeWidth={1.25}
                            aria-hidden="true"
                            className="mx-auto text-ivory/20"
                          />
                          <span className="sr-only">
                            {dict.discovery.compare.no}
                          </span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
