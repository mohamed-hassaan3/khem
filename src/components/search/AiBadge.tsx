/**
 * The "AI-powered" mark — prompts/ai-search-redesign.md.
 *
 * Deliberately quiet: a hairline gold outline, small caps, one stroke star. No
 * gradient, glow or motion. It is real text (a screen reader reads it), and the
 * callers decide *whether* it renders: only when meaning-based search is
 * configured (the field) or actually ran for the query (results).
 *
 * Server-safe: no hooks, the label is passed in.
 */

export function AiStar({ className = "" }: { className?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d="M6 .5C6.5 3.6 8.4 5.5 11.5 6 8.4 6.5 6.5 8.4 6 11.5 5.5 8.4 3.6 6.5.5 6 3.6 5.5 5.5 3.6 6 .5Z" />
    </svg>
  );
}

export default function AiBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border border-gold/55 px-2.5 py-1 font-body text-[9px] font-medium uppercase tracking-[0.2em] text-ground-accent rtl:text-[11px] rtl:tracking-normal">
      <AiStar />
      {label}
    </span>
  );
}

/** "Ranked by meaning" — the results-level mark, hybrid mode only. */
export function RankedByMeaning({ label, badge }: { label: string; badge?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-ground-accent">
      <AiStar />
      {badge ? `${label} · ${badge}` : label}
    </span>
  );
}
