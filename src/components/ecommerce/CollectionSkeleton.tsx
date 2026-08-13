/**
 * Loading skeleton for `/collections` and `/collections/[slug]` — Server
 * Component, no props.
 *
 * Why a skeleton here instead of `<LoadingScreen>`: this route has a fixed,
 * predictable shape — hero, description/sort bar, tabs, chips, 3-up grid — and
 * outlining it lets the real content land *into* its own frame rather than
 * replacing a black field. No layout jump, and it reads as the page arriving
 * rather than the app stalling.
 *
 * Block heights track `<CollectionView>` deliberately (hero `h-[60vh]
 * min-h-105`, the same paddings and `max-w-350` rails, `aspect-3/4` cards in a
 * `gap-px bg-border` grid). If that layout changes, this has to move with it —
 * a skeleton that no longer matches its page is worse than none.
 *
 * Six cards, not the real count: the count is unknown until the data lands, and
 * six fills the fold at every breakpoint without implying a total.
 */

/** One placeholder block. `aria-hidden` — the wrapper carries the status. */
function Bar({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`khem-shimmer bg-white/4 ${className}`}
    />
  );
}

const CARDS = [0, 1, 2, 3, 4, 5];

/** Varied widths so the chip row reads as type, not as a progress bar. */
const CHIPS = ["w-24", "w-32", "w-28", "w-36", "w-26"];

const TABS = ["w-20", "w-28", "w-24", "w-32"];

export default function CollectionSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading collection"
      className="min-h-screen bg-background"
    >
      {/* ── HERO ───────────────────────────────────── */}
      <section className="relative flex h-[60vh] min-h-105 items-end overflow-hidden bg-surface">
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />

        <div className="relative z-1 w-full px-6 pb-14 md:px-20 md:pb-18">
          <div className="mx-auto max-w-350">
            <Bar className="mb-8 h-3 w-40" />
            <Bar className="mb-4 h-2.5 w-28" />
            <Bar className="h-10 w-64 sm:w-80 md:h-14 md:w-96" />
          </div>
        </div>
      </section>

      {/* ── DESCRIPTION + SORT BAR ──────────────────── */}
      <section className="border-b border-border bg-background px-6 py-10 md:px-20">
        <div className="mx-auto flex max-w-350 flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full max-w-lg flex-col gap-3">
            <Bar className="h-2.5 w-full" />
            <Bar className="h-2.5 w-4/5" />
          </div>

          <Bar className="h-10 w-44 shrink-0" />
        </div>
      </section>

      {/* ── COLLECTION TABS ─────────────────────────── */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-350 gap-10 overflow-hidden px-6 py-5 md:px-20">
          {TABS.map((width) => (
            <Bar key={width} className={`h-3 shrink-0 ${width}`} />
          ))}
        </div>
      </div>

      {/* ── FACET CHIPS ─────────────────────────────── */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-350 items-center gap-2.5 overflow-hidden px-6 py-4 md:px-20">
          {CHIPS.map((width) => (
            <Bar key={width} className={`h-9 shrink-0 ${width}`} />
          ))}
        </div>
      </div>

      {/* ── PRODUCT GRID ────────────────────────────── */}
      <section className="bg-background px-6 pb-24 pt-16 md:px-20 md:pb-36">
        <div className="mx-auto grid max-w-350 grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((index) => (
            <div key={index} className="bg-surface">
              <Bar className="aspect-3/4 w-full" />

              <div className="flex flex-col gap-3 p-6">
                <Bar className="h-2 w-24" />
                <Bar className="h-4 w-40" />
                <Bar className="h-2.5 w-32" />

                <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
                  <Bar className="h-3 w-16" />
                  <Bar className="h-2.5 w-12" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
