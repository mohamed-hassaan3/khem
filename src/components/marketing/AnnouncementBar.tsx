"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { Announcement, AnnouncementMode } from "@/src/types/marketing";

/**
 * The strip above the header.
 *
 * ## Why it does not shift the page
 *
 * Its height is a CSS custom property (`--announcement-h`, set in
 * `globals.css` from a `data-announcement` attribute the layout writes on
 * `<body>`). `<Nav>` is positioned at that offset and the page wrapper is padded
 * by it, so every existing `pt-20` page offset keeps meaning "80px below the
 * header". The value is in the server HTML, so nothing about this bar arrives
 * after paint and it cannot contribute to CLS — which is also why it is **not**
 * dismissible: a bar that can vanish is a bar that reflows the document.
 *
 * ## Three modes, one line of text
 *
 * `STATIC` prints the first live announcement. `CAROUSEL` cross-fades between
 * them on the configured interval. `MARQUEE` drifts a duplicated track
 * continuously.
 *
 * All three keep the bar exactly one line tall at every width — the message is
 * truncated rather than allowed to wrap, because a bar that grows a second line
 * on a phone is a bar that moves the whole page down on a phone.
 *
 * ## Motion
 *
 * The marquee is a CSS animation, so `prefers-reduced-motion` switches it off in
 * the stylesheet rather than through a hook: the track simply stops at its
 * starting position and the bar reads as static. No JavaScript is involved in
 * honouring that preference, so it holds before hydration too. The carousel
 * drops its cross-fade under the same query and swaps instantly — the rotation
 * itself is a content change rather than motion, and stopping it would leave a
 * reduced-motion visitor able to read only one of several announcements.
 *
 * The animation is paused while the pointer is over the bar and while anything
 * inside it has focus, so a link in a moving track can actually be clicked.
 *
 * ## Going back
 *
 * The carousel carries two arrows. A rotating bar has one real failure — a
 * visitor reads half a line and it is replaced — and the only fix for it is a
 * way back. They wrap in both directions: from the first message, previous
 * shows the last, which is what the automatic rotation already does going
 * forward, so the two agree about the shape of the list.
 *
 * A click restarts the timer rather than adding a second one. `epoch` is in the
 * interval effect's dependency list, so selecting a message tears the interval
 * down and arms a fresh one — the chosen message then holds for its full
 * interval instead of being rotated away immediately, and there is never more
 * than one timer alive because that effect's cleanup is its only owner.
 *
 * The arrows appear in `CAROUSEL` alone. `STATIC` has nowhere to go, and the
 * marquee is a continuous track with no discrete current message to step
 * between — arrows there would have to mean something invented.
 *
 * They sit **beside the message**, not at the ends of the bar. Pinned to the
 * viewport edges they were two unexplained glyphs a metre apart on a desktop
 * screen, with no visible relationship to the sentence they move; beside the
 * text they read as one control — `←  message  →` — and the group stays
 * together at every width. The message truncates before it reaches either
 * arrow, so the bar is still exactly one line tall and still cannot reflow the
 * page.
 *
 * ## Stacking
 *
 * `z-997` sits **below** the mega-menu scrim (`z-998`) and the mobile drawer
 * (`z-1000`/`z-1001`) on purpose. The bar never overlaps `<Nav>` — they are
 * stacked vertically — so the only question a z-index answers here is what
 * happens when an overlay dims the page, and the answer is that the bar dims
 * with it. A marketing line left glowing over a darkened site reads as a
 * rendering fault.
 */

/** Seconds of travel per announcement. Slow enough to read at a glance. */
const MARQUEE_SECONDS_PER_ITEM = 9;

export default function AnnouncementBar({
  announcements,
  mode,
  intervalMs,
}: {
  announcements: readonly Announcement[];
  mode: AnnouncementMode;
  intervalMs: number;
}) {
  const dict = useDictionary();
  const [index, setIndex] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  /*
   * One announcement cannot rotate and cannot drift. Collapsing to `STATIC`
   * here rather than in each branch means the timer below is never armed for a
   * list that has nowhere to go.
   */
  const effectiveMode: AnnouncementMode =
    announcements.length <= 1 ? "STATIC" : mode;

  useEffect(() => {
    if (effectiveMode !== "CAROUSEL" || isPaused) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % announcements.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
    // `epoch` is the reset: an arrow restarts this interval rather than
    // adding one.
  }, [effectiveMode, isPaused, epoch, intervalMs, announcements.length]);

  /** Step the bar by hand, and give the new message a full interval. */
  function step(delta: 1 | -1) {
    setIndex((current) => {
      const count = announcements.length;
      return (current + delta + count) % count;
    });
    setEpoch((current) => current + 1);
  }

  /*
   * The list is doubled so the track can loop seamlessly: the animation travels
   * exactly half its width, at which point the second copy sits where the first
   * began. The copy is `aria-hidden`, so a screen reader hears each message
   * once.
   */
  const marqueeDuration = useMemo(
    () => `${announcements.length * MARQUEE_SECONDS_PER_ITEM}s`,
    [announcements.length],
  );

  if (announcements.length === 0) return null;

  return (
    <aside
      aria-label={dict.announcementBar.label}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      /*
        `ground-charcoal`: the bar sits above the header and is the same colour
        on every page, so it declares its ground rather than inheriting the one
        beneath the header.

        Charcoal rather than the pure black this was. It is the only band of
        dark above the fold, and it earns that by being the house speaking —
        but at #000 it read as a system notification bar bolted onto the top of
        the page. In charcoal it matches the footer, so the document is
        bracketed by the same colour top and bottom instead of opening on a
        colour that appears nowhere else.
      */
      className="announcement-bar ground-charcoal fixed inset-x-0 top-0 z-997 flex h-[var(--announcement-h)] items-center overflow-hidden border-b border-ground-accent/15 bg-ground-bg text-ground-muted"
    >
      {effectiveMode === "MARQUEE" ? (
        <div
          className="khem-marquee flex w-max shrink-0 items-center"
          style={{
            animationDuration: marqueeDuration,
            animationPlayState: isPaused ? "paused" : "running",
          }}
        >
          <MarqueeRun announcements={announcements} />
          <MarqueeRun announcements={announcements} duplicate />
        </div>
      ) : (
        /*
         * One centred row: arrow, message, arrow. The row is `max-w-full` and
         * the message `min-w-0`, which is what lets the sentence truncate
         * rather than push the arrows off the ends of the bar on a narrow
         * phone.
         */
        <div className="mx-auto flex max-w-full items-center justify-center px-2 sm:px-4">
          {effectiveMode === "CAROUSEL" ? (
            <Arrow
              direction="previous"
              label={dict.announcementBar.previous}
              onClick={() => step(-1)}
            />
          ) : null}

          {/*
           * `polite`, never `assertive`: a rotating marketing line must not
           * interrupt what somebody is reading further down the page.
           */}
          <p
            aria-live="polite"
            aria-atomic="true"
            className="min-w-0 px-1 text-center sm:px-2"
          >
            <Message
              key={announcements[index % announcements.length].id}
              announcement={announcements[index % announcements.length]}
              fade={effectiveMode === "CAROUSEL"}
            />
          </p>

          {effectiveMode === "CAROUSEL" ? (
            <Arrow
              direction="next"
              label={dict.announcementBar.next}
              onClick={() => step(1)}
            />
          ) : null}
        </div>
      )}
    </aside>
  );
}

/**
 * One of the two carousel controls, in the row beside the message.
 *
 * The order in the DOM is previous-message-next, so direction follows the
 * writing mode for free: in Arabic the row is laid out right-to-left and
 * "previous" is on the right, where a reader of Arabic reaches for it. The
 * glyph is mirrored in CSS for the same reason — a chevron pointing the wrong
 * way in RTL is the commonest version of this bug, and it is a layout question
 * rather than a locale one.
 *
 * The hit area is the full height of the bar and 36px wide — as wide as the bar
 * is tall, so the target is square rather than a sliver. What is *drawn* is a
 * 13px chevron at muted weight: this is the site's quietest strip of chrome and
 * the arrows have to be findable without becoming the loudest thing on it.
 */
function Arrow({
  direction,
  label,
  onClick,
}: {
  direction: "previous" | "next";
  label: string;
  onClick: () => void;
}) {
  const Glyph = direction === "previous" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-[var(--announcement-h)] w-9 shrink-0 items-center justify-center text-ground-muted transition-colors duration-300 hover:text-ground focus-visible:text-ground-accent focus-visible:outline-none"
    >
      <Glyph
        size={13}
        strokeWidth={1.25}
        aria-hidden
        className="rtl:-scale-x-100"
      />
    </button>
  );
}

/** One pass of the list, laid out inline for the marquee track. */
function MarqueeRun({
  announcements,
  duplicate = false,
}: {
  announcements: readonly Announcement[];
  duplicate?: boolean;
}) {
  return (
    <span
      aria-hidden={duplicate || undefined}
      className="flex shrink-0 items-center"
      inert={duplicate || undefined}
    >
      {announcements.map((announcement) => (
        <span
          key={`${duplicate ? "dup" : "run"}-${announcement.id}`}
          className="flex shrink-0 items-center"
        >
          <span className="px-8 sm:px-12">
            <Message announcement={announcement} inert={duplicate} />
          </span>
          {/* A hairline diamond between messages, not a bullet. */}
          <span aria-hidden className="text-ground-accent/30">
            ◆
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * The message itself, linked when it has somewhere to go.
 *
 * `dir="auto"` rather than a fixed direction: an untranslated row falls back to
 * English inside the Arabic tree, and only the text that actually rendered can
 * decide which way it runs — the rule `src/lib/i18n/rtl.ts` sets out.
 */
function Message({
  inert,
  announcement,
  fade = false,
}: {
  announcement: Announcement;
  fade?: boolean;
  inert?: boolean;
}) {
  const body = (
    <>
      <span className="truncate" inert={inert}>
        {announcement.message}
      </span>
      {announcement.ctaLabel ? (
        <span className="ms-2 shrink-0 border-b border-ground-accent/40 pb-px text-ground-accent">
          {announcement.ctaLabel}
        </span>
      ) : null}
    </>
  );

  const className = [
    "inline-flex max-w-full items-center justify-center whitespace-nowrap font-heading text-[10px] tracking-[0.18em] uppercase sm:text-[11px]",
    fade ? "khem-announcement-fade" : "",
  ]
    .join(" ")
    .trim();

  if (announcement.href) {
    return (
      <LocaleLink
        href={announcement.href}
        dir="auto"
        className={`${className} text-inherit no-underline transition-colors duration-300 hover:text-ground`}
      >
        {body}
      </LocaleLink>
    );
  }

  return (
    <span dir="auto" className={className}>
      {body}
    </span>
  );
}
