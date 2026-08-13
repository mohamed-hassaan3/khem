/**
 * A label with the matched query terms picked out in gold.
 *
 * The highlight is built by **slicing the original string into React children**,
 * never by injecting HTML. That is not a stylistic preference: the query is
 * visitor-controlled text, and the only reason `dangerouslySetInnerHTML` is
 * tempting here is exactly the reason it must not be used.
 *
 * Matching is diacritic- and case-insensitive to agree with the search itself —
 * "ambre" has to highlight inside "Ambré", or a result would look like a
 * mismatch to the person who typed it.
 */

import { Fragment } from "react";

import { fold } from "@/src/lib/search/text";

export interface HighlightedTextProps {
  text: string;
  /** Folded query terms — see `queryTerms()`. */
  terms: readonly string[];
}

/** Character ranges of `text` covered by any term, merged and ordered. */
function matchRanges(text: string, terms: readonly string[]): [number, number][] {
  /*
   * `fold()` is character-preserving for the scripts in this catalog —
   * lowercasing and stripping combining marks after NFD — so an index in the
   * folded string addresses the same character in the original. Guard anyway:
   * a length change would silently shift every highlight.
   */
  const folded = fold(text);
  if (folded.length !== text.length) return [];

  const ranges: [number, number][] = [];

  for (const term of terms) {
    if (!term) continue;
    let from = folded.indexOf(term);

    while (from !== -1) {
      ranges.push([from, from + term.length]);
      from = folded.indexOf(term, from + term.length);
    }
  }

  if (ranges.length === 0) return [];

  ranges.sort((a, b) => a[0] - b[0]);

  // Overlapping terms ("oud" and "ou") must not produce nested <mark>s.
  const merged: [number, number][] = [ranges[0]];
  for (const [start, end] of ranges.slice(1)) {
    const last = merged[merged.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  return merged;
}

export default function HighlightedText({ text, terms }: HighlightedTextProps) {
  const ranges = matchRanges(text, terms);
  if (ranges.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  ranges.forEach(([start, end], index) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={`${start}-${index}`} className="bg-transparent text-gold">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });

  if (cursor < text.length) parts.push(text.slice(cursor));

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </>
  );
}
