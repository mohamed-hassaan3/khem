"use client";

/**
 * The search box above a dashboard list.
 *
 * The term lives in the URL (`?q=…`), not in component state, for three
 * reasons: a filtered list is linkable and survives a reload, the back button
 * behaves the way an editor expects, and the filtering itself stays on the
 * server where the rows already are.
 *
 * `router.replace` rather than `push`, debounced: typing eight characters
 * should not put eight entries in the browser's history for the back button to
 * walk out of one at a time. `scroll: false` keeps the page where it was —
 * jumping to the top on every keystroke is disorienting when the thing you are
 * reading is a table.
 *
 * Submitting does nothing beyond blurring: there is no round trip to wait for
 * that the debounce has not already started.
 */

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Long enough to finish a word, short enough not to feel laggy. */
const DEBOUNCE_MS = 250;

export default function AdminSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlTerm = searchParams.get("q") ?? "";
  const [term, setTerm] = useState(urlTerm);

  /**
   * The last term *this component* wrote to the URL.
   *
   * State rather than a ref, even though nothing renders it: the comparison
   * below happens *during* render, and a ref read during render is both
   * lint-flagged and genuinely unsafe — React does not guarantee a render that
   * reads a mutable ref will re-run when it changes.
   */
  const [pushedTerm, setPushedTerm] = useState(urlTerm);

  /*
   * Follow the URL when it changes from outside this input — the back button,
   * or a link into an already-filtered list.
   *
   * Adjusted during render rather than in an effect. An effect would set state
   * after the browser had already been handed a paint with the stale term,
   * causing a visible flash and a cascading render; React re-runs this
   * component immediately instead, before anything is shown.
   *
   * ⚠ The `pushedTerm` guard is what makes fast typing work, and removing it
   * deletes characters. Each debounced write navigates, and that navigation
   * arrives back here as a *changed* `urlTerm` some milliseconds later — by
   * which time more has been typed. Without the guard the sync cannot tell the
   * echo of its own write from a real outside change, and it "restores" the
   * input to the older term, swallowing every keystroke made while the
   * navigation was in flight. Comparing against what we last pushed
   * distinguishes the two: an echo matches it, the back button does not.
   */
  const [lastUrlTerm, setLastUrlTerm] = useState(urlTerm);
  if (urlTerm !== lastUrlTerm) {
    setLastUrlTerm(urlTerm);
    if (urlTerm !== pushedTerm) setTerm(urlTerm);
  }

  useEffect(() => {
    if (term === urlTerm) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (term.trim().length === 0) {
        next.delete("q");
      } else {
        next.set("q", term);
      }

      // Recorded before navigating, so the render that observes the resulting
      // `urlTerm` can recognise it as ours.
      setPushedTerm(term);

      const query = next.toString();
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, urlTerm, pathname, router, searchParams]);

  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className="relative mb-6 max-w-md"
    >
      <label htmlFor="admin-search" className="sr-only">
        {placeholder}
      </label>

      <Search
        size={14}
        strokeWidth={1.25}
        aria-hidden
        className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ground-subtle"
      />

      <input
        id="admin-search"
        type="search"
        value={term}
        placeholder={placeholder}
        onChange={(event) => setTerm(event.target.value)}
        className="w-full border border-ground-border bg-ivory/3 py-3 pe-10 ps-11 text-[13px] tracking-wide text-ground transition-colors duration-300 placeholder:text-ground-subtle focus:border-gold/40 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />

      {term.length > 0 ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setTerm("")}
          className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-ground-muted transition-colors duration-300 hover:text-ground-accent focus:outline-none"
        >
          <X size={14} strokeWidth={1.25} />
        </button>
      ) : null}
    </form>
  );
}
