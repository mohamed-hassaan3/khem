"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

import ConsentToggle from "./ConsentToggle";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import {
  CONSENT_CATEGORIES,
  toConsentChoices,
  type ConsentChoices,
} from "@/src/lib/consent";
import { formatConsentDate } from "@/src/lib/format";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useConsent } from "@/src/providers/consent-provider";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";

/**
 * The cookie consent banner.
 *
 * ## Non-blocking by design
 *
 * A `role="region"` landmark, not a dialog: no scrim, no scroll lock, no focus
 * trap. A visitor can keep reading — including the Cookie Policy this links to —
 * and decide afterwards. Holding the site hostage behind a modal is the pattern
 * this deliberately avoids, and it is also why *Decline* carries the same visual
 * weight as *Accept All* and sits one click away. There is no bare "×": a silent
 * dismissal would leave the stored decision ambiguous, so the only exits are the
 * three that record an answer.
 *
 * ## Layering
 *
 * `z-990` — above page content, beneath the mega-menu scrim (`z-998`), the nav
 * (`z-1000`), the mobile drawer (`z-1001`), and the search overlay (`z-1100`).
 *
 * ## Motion
 *
 * Tween only, on `--ease-luxury-bezier`, per AGENTS.md §2.2 — no spring, no
 * bounce. The entry is delayed so the banner arrives *after* the page has
 * settled rather than competing with the hero, but only on a first visit:
 * reopening from the footer is a deliberate act and must feel instantaneous.
 * Under `prefers-reduced-motion` everything collapses to a short crossfade with
 * no travel and no height animation.
 *
 * ## Why `fixed`
 *
 * It never participates in document flow, so it cannot contribute to CLS no
 * matter when it appears.
 */

/** `--ease-luxury-bezier` as a tuple, matching `animation/Reveal.tsx`. */
const EASE_LUXURY: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Long enough for the hero to settle, short enough to feel intentional. */
const ENTRY_DELAY_MS = 900;

const ghostButtonClass = [
  "inline-flex items-center justify-center border border-white/12 px-7 py-3.5",
  "font-heading text-[0.7rem] uppercase tracking-[0.2em] text-ivory/75",
  "transition-all duration-500 ease-luxury-bezier",
  "hover:border-gold/50 hover:text-gold",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/60",
].join(" ");

const goldButtonClass = [
  "inline-flex items-center justify-center border border-gold bg-gold px-7 py-3.5",
  "font-heading text-[0.7rem] uppercase tracking-[0.2em] text-black",
  "transition-all duration-500 ease-luxury-bezier",
  "hover:border-champagne hover:bg-champagne hover:shadow-gold",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/60",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
].join(" ");

export default function CookieConsent() {
  const dict = useDictionary();
  const locale = useLocale();
  const copy = dict.cookieConsent;

  const { record, isOpen, isReopened, acceptAll, declineAll, save } =
    useConsent();

  const prefersReducedMotion = useReducedMotion();

  const titleId = useId();
  const panelId = useId();
  const categoryLabelId = useId();
  const cardRef = useRef<HTMLElement>(null);

  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<ConsentChoices>(() =>
    toConsentChoices(record),
  );

  /*
   * Two pieces of state derived from props *during render* — the pattern React
   * documents for "an input changed, recompute from it", and the one already
   * used in `SearchOverlay.tsx`. An effect would paint one frame with the stale
   * value still on screen.
   */
  const [syncedRecord, setSyncedRecord] = useState(record);
  if (syncedRecord !== record) {
    setSyncedRecord(record);
    setDraft(toConsentChoices(record));
  }

  // Reopening from the footer means "show me the settings", so the panel opens
  // expanded; a first-visit banner opens collapsed.
  const [syncedReopened, setSyncedReopened] = useState(isReopened);
  if (syncedReopened !== isReopened) {
    setSyncedReopened(isReopened);
    if (isReopened) setExpanded(true);
  }

  /*
   * The entry delay. Reopening skips it — the visitor just asked for the panel,
   * so anything but an instant response reads as a bug — and so does reduced
   * motion, where a delay before an un-animated element reads as lag rather
   * than as choreography.
   *
   * `skipDelay` is folded into `visible` rather than pushed into the timer's
   * state, so the effect only ever schedules; it never sets state synchronously
   * and never causes a cascading render.
   */
  const skipDelay = isReopened || prefersReducedMotion === true;

  const [delayElapsed, setDelayElapsed] = useState(false);
  useEffect(() => {
    if (!isOpen || skipDelay) return;

    const timer = window.setTimeout(() => setDelayElapsed(true), ENTRY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen, skipDelay]);

  const visible = isOpen && (skipDelay || delayElapsed);

  /*
   * Focus moves to the card only when the visitor reopened it. Stealing focus
   * from someone who is mid-sentence on a first visit would be hostile, and the
   * banner is a landmark they can reach on their own terms.
   */
  useEffect(() => {
    if (visible && isReopened) cardRef.current?.focus();
  }, [visible, isReopened]);

  return (
    <AnimatePresence>
      {visible && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-990 px-4 pb-4 sm:px-6 sm:pb-6"
          role="region"
          aria-label={copy.regionLabel}
        >
          <motion.article
            ref={cardRef}
            tabIndex={-1}
            aria-labelledby={titleId}
            initial={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 32 }
            }
            animate={
              prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
            }
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{
              duration: prefersReducedMotion ? 0.2 : 0.7,
              ease: EASE_LUXURY,
            }}
            className={[
              "pointer-events-auto relative mx-auto w-full max-w-5xl",
              "rounded-lg border border-border-gold/40",
              "bg-[color-mix(in_srgb,var(--color-surface)_92%,transparent)]",
              "p-6 shadow-luxury backdrop-blur-xl focus:outline-none sm:p-8",
            ].join(" ")}
          >
            {/* Hairline gold rule along the top edge of the card. */}
            <span
              aria-hidden="true"
              className="absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-gold/50 to-transparent"
            />

            <p className="eyebrow mb-3">{copy.eyebrow}</p>

            <h2
              id={titleId}
              className="mb-4 font-heading text-lg tracking-[0.12em] text-ivory sm:text-xl"
            >
              {copy.title}
            </h2>

            <p className="max-w-2xl text-sm leading-relaxed text-ivory/65">
              {copy.body}
            </p>

            <LocaleLink
              href="/cookie-policy"
              className="mt-3 inline-block text-xs tracking-[0.08em] text-gold/80 underline-offset-4 transition-colors duration-300 hover:text-gold hover:underline"
            >
              {copy.policyLink}
            </LocaleLink>

            {/* ── PREFERENCES PANEL ──────────────────────── */}
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  id={panelId}
                  initial={
                    prefersReducedMotion
                      ? { opacity: 1 }
                      : { height: 0, opacity: 0 }
                  }
                  animate={
                    prefersReducedMotion
                      ? { opacity: 1 }
                      : { height: "auto", opacity: 1 }
                  }
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { height: 0, opacity: 0 }
                  }
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.5,
                    ease: EASE_LUXURY,
                  }}
                  className="overflow-hidden"
                >
                  <div className="mt-7 divide-y divide-white/6 border-y border-white/6">
                    {/* Essential — stated, never offered as a choice. */}
                    <div className="flex items-start justify-between gap-6 py-4">
                      <div>
                        <p className="font-heading text-[0.72rem] uppercase tracking-[0.18em] text-ivory">
                          {copy.categories.essential.name}
                        </p>
                        <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-ivory/55">
                          {copy.categories.essential.description}
                        </p>
                      </div>
                      <span className="shrink-0 whitespace-nowrap pt-1 text-[0.65rem] uppercase tracking-[0.18em] text-gold/70">
                        {copy.alwaysActive}
                      </span>
                    </div>

                    {CONSENT_CATEGORIES.map((category) => (
                      <div
                        key={category}
                        className="flex items-start justify-between gap-6 py-4"
                      >
                        <div>
                          <p
                            id={`${categoryLabelId}-${category}`}
                            className="font-heading text-[0.72rem] uppercase tracking-[0.18em] text-ivory"
                          >
                            {copy.categories[category].name}
                          </p>
                          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-ivory/55">
                            {copy.categories[category].description}
                          </p>
                        </div>
                        <div className="pt-0.5">
                          <ConsentToggle
                            checked={draft[category]}
                            labelledBy={`${categoryLabelId}-${category}`}
                            onChange={(next) =>
                              setDraft((previous) => ({
                                ...previous,
                                [category]: next,
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {record !== null && (
                    <p className="mt-4 text-[0.68rem] tracking-[0.08em] text-ivory/30">
                      {interpolate(copy.lastUpdated, {
                        date: formatConsentDate(record.decidedAt, locale),
                      })}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── ACTIONS ────────────────────────────────── */}
            <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setExpanded((previous) => !previous)}
                aria-expanded={expanded}
                aria-controls={expanded ? panelId : undefined}
                className="group inline-flex items-center gap-2 self-start text-[0.7rem] uppercase tracking-[0.18em] text-ivory/55 transition-colors duration-300 hover:text-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/60"
              >
                <span className="relative">
                  {expanded ? copy.hidePreferences : copy.managePreferences}
                  {/* Grows from the logical start edge, so it mirrors in RTL. */}
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1 start-0 h-px w-0 bg-gold transition-[width] duration-500 ease-luxury-bezier group-hover:w-full"
                  />
                </span>
                <ChevronDown
                  strokeWidth={1.25}
                  className={[
                    "size-3.5 transition-transform duration-500 ease-luxury-bezier",
                    expanded ? "rotate-180" : "rotate-0",
                  ].join(" ")}
                />
              </button>

              {/*
               * `flex-col-reverse` on a phone puts the primary action closest to
               * the thumb while keeping Decline first in DOM (and tab) order —
               * the reject path must never be harder to reach than accept.
               */}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={declineAll}
                  className={ghostButtonClass}
                >
                  {copy.decline}
                </button>

                {expanded ? (
                  <button
                    type="button"
                    onClick={() => save(draft)}
                    className={goldButtonClass}
                  >
                    {copy.savePreferences}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={acceptAll}
                    className={goldButtonClass}
                  >
                    {copy.acceptAll}
                  </button>
                )}
              </div>
            </div>
          </motion.article>
        </div>
      )}
    </AnimatePresence>
  );
}
