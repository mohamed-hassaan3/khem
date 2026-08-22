/**
 * The frame around a chart: title, headline figure, and the empty state.
 *
 * A Server Component, deliberately — everything here is text, and rendering it
 * beside the chart rather than inside it keeps the client bundle to the canvas.
 *
 * The empty state is the reason this exists. A chart of thirty zeros is a flat
 * line against an axis, which reads as "sales collapsed" rather than "nothing
 * has been recorded yet". A sentence says the true thing.
 *
 * The chart itself is `aria-hidden` (a canvas has nothing to announce), so the
 * summary line here is also what a screen reader gets.
 */

import type { ReactNode } from "react";

export default function ChartPanel({
  title,
  figure,
  caption,
  isEmpty,
  emptyMessage,
  children,
  action,
}: {
  title: string;
  figure?: string;
  caption?: string;
  isEmpty: boolean;
  emptyMessage: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="border border-border bg-ivory/2 p-6 sm:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
            {title}
          </h2>
          {figure ? (
            <p className="mt-3 font-heading text-3xl tracking-[0.1em] text-gold">
              {figure}
            </p>
          ) : null}
          {caption ? (
            <p className="mt-2 text-[11px] tracking-wide text-ivory/30">{caption}</p>
          ) : null}
        </div>
        {action}
      </header>

      {isEmpty ? (
        <div className="flex h-[260px] items-center justify-center border border-dashed border-border">
          <p className="max-w-sm text-center text-[12px] leading-relaxed text-ivory/30">
            {emptyMessage}
          </p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
