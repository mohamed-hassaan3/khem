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
 * min-h-105`, the same paddings and `max-w-350` rails, `aspect-4/5` cards in a
 * 2 / 3 / 4 grid). If that layout changes, this has to move with it —
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
      className={`khem-shimmer bg-stone ${className}`}
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
      className="ground-ivory min-h-screen"
    >
      {/* ── HERO ───────────────────────────────────── */}
      {/*
        The banner placeholder, on sand.

        It stood in for a dark full-bleed photograph and was drawn as obsidian
        with a black gradient over it, so the first thing a visitor saw when
        opening a collection was a black rectangle that then resolved into a
        light page. A skeleton that predicts the wrong environment is worse
        than no skeleton — it forecasts a flash. Sand is the ground the real
        collection banner lands on, so the placeholder now settles into the
        page instead of being replaced by it.
      */}
      <section className="ground-sand relative flex h-[60vh] min-h-105 items-end overflow-hidden">

        <div className="relative z-1 w-full px-4 pb-14 sm:px-6 md:px-10 lg:px-12 xl:px-16 md:pb-18">
          <div className="mx-auto max-w-350">
            <Bar className="mb-8 h-3 w-40" />
            <Bar className="mb-4 h-2.5 w-28" />
            <Bar className="h-10 w-64 sm:w-80 md:h-14 md:w-96" />
          </div>
        </div>
      </section>

      {/* ── DESCRIPTION + SORT BAR ──────────────────── */}
      <section className="border-b border-ground-border px-4 py-10 sm:px-6 md:px-10 lg:px-12 xl:px-16">
        <div className="mx-auto flex max-w-350 flex-col gap-4 md:gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full max-w-lg flex-col gap-3">
            <Bar className="h-2.5 w-full" />
            <Bar className="h-2.5 w-4/5" />
          </div>

          <Bar className="h-10 w-44 shrink-0" />
        </div>
      </section>

      {/* ── COLLECTION TABS ─────────────────────────── */}
      <div className="border-b border-ground-border">
        <div className="mx-auto flex max-w-350 gap-5 md:gap-10 overflow-hidden px-4 py-5 sm:px-6 md:px-10 lg:px-12 xl:px-16">
          {TABS.map((width) => (
            <Bar key={width} className={`h-3 shrink-0 ${width}`} />
          ))}
        </div>
      </div>

      {/* ── FACET CHIPS ─────────────────────────────── */}
      <div className="border-b border-ground-border">
        <div className="mx-auto flex max-w-350 items-center gap-2.5 overflow-hidden px-4 py-4 sm:px-6 md:px-10 lg:px-12 xl:px-16">
          {CHIPS.map((width) => (
            <Bar key={width} className={`h-9 shrink-0 ${width}`} />
          ))}
        </div>
      </div>

      {/* ── PRODUCT GRID ────────────────────────────── */}
      <section className="px-4 pb-14 pt-10 sm:px-6 md:px-10 lg:px-12 xl:px-16 md:pb-36">
        <div className="mx-auto grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-4 max-w-350">
          {CARDS.map((index) => (
            /*
              `.card`, matching the real card exactly. The mosaic grid used to
              draw the edges, so a bare `bg-surface` block was enough; with real
              gaps between cards a skeleton without a border is a floating patch
              of slightly-lighter nothing, and the placeholder stops predicting
              the shape it is standing in for.
            */
            <div key={index} className="card overflow-hidden">
              <Bar className="aspect-4/5 w-full" />

              <div className="flex flex-col gap-3 p-3 sm:p-4">
                <Bar className="h-2 w-24" />
                <Bar className="h-4 w-40" />
                <Bar className="h-2.5 w-32" />

                <div className="mt-2 flex items-center justify-between border-t border-ground-border pt-3">
                  <Bar className="h-3 w-16" />
                  {/* The bag control's 44px footprint. */}
                  <Bar className="size-11" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
