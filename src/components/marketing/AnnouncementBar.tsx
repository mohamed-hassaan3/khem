"use client";

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
  }, [effectiveMode, isPaused, intervalMs, announcements.length]);

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
      className="ground-charcoal fixed inset-x-0 top-0 z-997 flex h-[var(--announcement-h)] items-center overflow-hidden border-b border-ground-accent/15 bg-ground-bg text-ground-muted"
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
         * `polite`, never `assertive`: a rotating marketing line must not
         * interrupt what somebody is reading further down the page.
         */
        <p
          aria-live="polite"
          aria-atomic="true"
          className="w-full px-5 text-center sm:px-8"
        >
          <Message
            key={announcements[index % announcements.length].id}
            announcement={announcements[index % announcements.length]}
            fade={effectiveMode === "CAROUSEL"}
          />
        </p>
      )}
    </aside>
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
    >
      {announcements.map((announcement) => (
        <span
          key={`${duplicate ? "dup" : "run"}-${announcement.id}`}
          className="flex shrink-0 items-center"
        >
          <span className="px-8 sm:px-12">
            <Message announcement={announcement} />
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
  announcement,
  fade = false,
}: {
  announcement: Announcement;
  fade?: boolean;
}) {
  const body = (
    <>
      <span className="truncate">{announcement.message}</span>
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
