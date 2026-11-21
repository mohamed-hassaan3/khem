"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";

import { setMarketingPreference } from "@/src/actions/preferences";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";

/**
 * The one thing a customer may decide about how the house writes to them.
 *
 * ## It says what it does not govern
 *
 * The line beneath the switch is not filler. The single most common reason
 * somebody hesitates over a marketing toggle is fear of losing their receipts,
 * and saying plainly that order letters arrive either way is what makes the
 * choice a real one. It is also true: §9.1, and none of the transactional
 * senders reads this flag.
 *
 * ## Optimistic, then corrected
 *
 * The switch moves at once and the action reports what actually landed — the
 * server's answer wins. A consent control that lagged a round trip invites a
 * second click, and a second click on a toggle is a customer who has just turned
 * their preference back to where it started without meaning to.
 *
 * On failure it returns to where it was and says so, rather than sitting in a
 * state the database does not share.
 */

export default function MarketingPreference({
  initial,
  copy,
}: {
  initial: boolean;
  copy: Dictionary["account"]["preferences"]["marketing"];
}) {
  const [optedIn, setOptedIn] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function change(next: boolean) {
    if (isPending) return;

    const previous = optedIn;
    setOptedIn(next);
    setFailed(false);
    setSaved(false);

    startTransition(async () => {
      const result = await setMarketingPreference({ marketingOptIn: next });

      if (!result.ok) {
        setOptedIn(previous);
        setFailed(true);
        return;
      }

      // What the server stored, which need not be what was asked for.
      setOptedIn(result.marketingOptIn);
      setSaved(true);
    });
  }

  /*
   * One settings row: the title and what it means on the reading side, a
   * 44×26 switch at the end. The whole row is the control, so the target is
   * the row, not the 26px pill. Below it, the always-mounted outcome line and
   * the note that transactional mail is never affected.
   */
  return (
    <section className="overflow-hidden rounded-lg border border-ground-border bg-stone">
      <button
        type="button"
        role="switch"
        aria-checked={optedIn}
        disabled={isPending}
        onClick={() => change(!optedIn)}
        className="flex min-h-16 w-full cursor-pointer items-center gap-4 bg-transparent px-4 py-3.5 text-start transition-colors duration-300 ease-luxury-bezier hover:bg-ground-bg/60 disabled:opacity-60 sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-ground">{copy.heading}</span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-ground-muted rtl:text-[12px]">
            {copy.body}
          </span>
        </span>

        <span
          aria-hidden="true"
          className={`relative h-[26px] w-11 shrink-0 rounded-full border transition-colors duration-500 ease-luxury-bezier ${
            optedIn ? "border-ground-accent bg-ground-accent" : "border-ground-border bg-ground-bg"
          }`}
        >
          <span
            className={`absolute top-[3px] size-[18px] rounded-full shadow-[0_1px_2px_rgba(13,13,13,0.2)] transition-[inset-inline-start,background-color] duration-500 ease-luxury-bezier ${
              optedIn ? "start-[21px] bg-ivory" : "start-[3px] bg-ink-subtle"
            }`}
          />
        </span>
      </button>

      {/* Always mounted, so a reader is told the outcome rather than a region
          appearing at the moment it fills. */}
      <p
        aria-live="polite"
        className={`px-4 text-[11px] sm:px-5 [&:not(:empty)]:pb-3 ${failed ? "text-danger" : "text-ground-accent"}`}
      >
        {isPending ? copy.saving : null}
        {!isPending && failed ? copy.failed : null}
        {!isPending && !failed && saved ? (
          <span className="inline-flex items-center gap-1.5">
            <Check size={12} strokeWidth={1.5} aria-hidden="true" />
            {copy.saved}
          </span>
        ) : null}
      </p>

      <p className="border-t border-ground-border px-4 py-3 text-[11px] leading-relaxed text-ground-muted sm:px-5">
        {copy.transactional}
      </p>
    </section>
  );
}
