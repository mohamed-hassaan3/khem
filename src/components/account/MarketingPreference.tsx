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

  return (
    <section className="border border-ground-border bg-stone px-6 py-6 sm:px-8 sm:py-7">
      <p className="mb-1.5 font-heading text-[13px] tracking-[0.08em] text-ground-accent">
        {copy.heading}
      </p>

      <p className="mb-6 max-w-prose text-[12px] leading-loose text-ground-muted">
        {copy.body}
      </p>

      <button
        type="button"
        role="switch"
        aria-checked={optedIn}
        disabled={isPending}
        onClick={() => change(!optedIn)}
        className="flex w-full items-start gap-4 border border-ground-border bg-ivory/3 px-4 py-4 text-start transition-colors duration-300 ease-luxury-bezier hover:border-ground-accent/30 focus-visible:border-ground-accent/40 focus-visible:outline-none disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-4 w-8 shrink-0 items-center rounded-full border transition-colors duration-300 ease-luxury-bezier ${
            optedIn ? "border-gold/50 bg-gold/25" : "border-ground-border bg-ivory/5"
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full transition-transform duration-300 ease-luxury-bezier ${
              optedIn ? "translate-x-4 bg-gold" : "translate-x-0.5 bg-ivory/40"
            }`}
          />
        </span>

        <span className="min-w-0 text-[12px] leading-relaxed text-ground-muted">
          {copy.label}
        </span>
      </button>

      {/* Always mounted, so a reader is told the outcome rather than a region
          appearing at the moment it fills. */}
      <p
        aria-live="polite"
        className={`mt-3 min-h-4 text-[11px] ${failed ? "text-danger" : "text-ground-accent/70"}`}
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

      <p className="mt-4 max-w-prose border-t border-ground-border pt-4 text-[11px] leading-loose text-ground-muted/70">
        {copy.transactional}
      </p>
    </section>
  );
}
