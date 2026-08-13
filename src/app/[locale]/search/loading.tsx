/**
 * Loading state for `/search`.
 *
 * The route is dynamic, so this is what streams while the query runs. It
 * outlines the page's own shape — header bar, search field, 3-up grid — rather
 * than showing the tree-wide roundel, so the results land into their frame
 * instead of replacing a black field.
 */

/** One placeholder block. `aria-hidden` — the wrapper carries the status. */
function Bar({ className }: { className: string }) {
  return <div aria-hidden="true" className={`khem-shimmer bg-white/4 ${className}`} />;
}

const CARDS = [0, 1, 2, 3, 4, 5];

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading search results"
      className="min-h-screen bg-background"
    >
      {/* Header — mirrors <PageHeader>'s paddings. */}
      <div className="border-b border-border px-6 pb-10 pt-14 sm:px-8 lg:px-14 lg:pb-12 lg:pt-16 xl:px-20">
        <Bar className="h-2.5 w-20" />
        <Bar className="mt-4 h-9 w-64 sm:h-11 sm:w-80" />
        <Bar className="mt-4 h-2.5 w-24" />
      </div>

      {/* Field — mirrors <SearchForm>. */}
      <div className="border-b border-border px-6 py-6 sm:px-8 lg:px-14 xl:px-20">
        <Bar className="h-7 w-full max-w-md" />
      </div>

      {/* Grid — mirrors the results section. */}
      <div className="mx-auto max-w-350 px-6 py-16 md:px-20">
        <div className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <div key={card}>
              <Bar className="aspect-3/4 w-full" />
              <Bar className="mt-5 h-3 w-2/5" />
              <Bar className="mt-3 h-2.5 w-1/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
