"use client";

import { useEffect, useRef, useState } from "react";

import PrelaunchSubscribe, {
  type PrelaunchSubscribeLabels,
} from "./PrelaunchSubscribe";

/**
 * ⚠️ TEMPORARY — the cover's two doors, and the one slot they share.
 *
 * The composition holds a single block beneath COMING SOON, and this component
 * owns what is in it: the two invitations, the World of KHEM index, or the Inner
 * Circle form. One at a time, in place.
 *
 * ## Why in place, and not a modal
 *
 * A dialog over a cover is a dialog over a dialog. There is nothing here to
 * dismiss back *to* except the same screen, so an overlay would add a focus
 * trap, a scrim and an `aria-modal` contract to buy nothing. Swapping the slot
 * keeps one reading order, one tab ring, and the film unobstructed — §21's
 * "the UI should feel almost invisible".
 *
 * ## Focus
 *
 * Opening moves focus into the panel; closing returns it to the control that was
 * pressed. Without the return, Escape would drop a keyboard visitor at the top
 * of the document and make the panel a one-way door. `Escape` is bound at the
 * document rather than the panel so it works wherever focus has wandered.
 *
 * ## What the World index deliberately omits
 *
 * Perfumes and collections. Those routes are closed while the cover is up — the
 * proxy sends them back here — so listing them would be an invitation to a
 * bounce. The five entries below are exactly the editorial pages that stay open,
 * and they are the existing routes: this component creates no page of its own,
 * per §6.
 */

/** The World of KHEM index — the existing editorial routes, nothing new. */
const WORLD_LINKS = [
  { href: "/heritage", label: "Our Heritage" },
  { href: "/craftsmanship", label: "Craftsmanship" },
  { href: "/ingredients", label: "Ingredients" },
  { href: "/journal", label: "Journal" },
  { href: "/about", label: "About KHEM" },
] as const;

type Panel = "idle" | "world" | "circle";

export default function PrelaunchPanels({
  subscribeLabels,
}: {
  subscribeLabels: PrelaunchSubscribeLabels;
}) {
  const [panel, setPanel] = useState<Panel>("idle");
  const worldButton = useRef<HTMLButtonElement>(null);
  const circleButton = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Which control to hand focus back to. Set on open, read on close. */
  const opener = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (panel === "idle") return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPanel("idle");
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panel]);

  useEffect(() => {
    if (panel === "idle") {
      opener.current?.focus();
      opener.current = null;
      return;
    }

    // The form focuses its own field (`autoFocus`), so only the link list needs
    // moving into — focusing the container itself would announce nothing.
    if (panel === "world") {
      panelRef.current?.querySelector("a")?.focus();
    }
  }, [panel]);

  function open(next: Panel, trigger: HTMLButtonElement | null) {
    opener.current = trigger;
    setPanel(next);
  }

  if (panel === "idle") {
    return (
      /*
       * No entrance animation on this branch. The cover's own staging is
       * applied by the wrapper in `PrelaunchCover`, which runs once; repeating
       * it here would make *closing* a panel cost a 700ms fade before the
       * invitations came back.
       */
      <div className="flex flex-col items-center gap-6 sm:gap-7">
        <button
          ref={worldButton}
          type="button"
          onClick={() => open("world", worldButton.current)}
          className="khem-cover-link khem-cover-focus cursor-pointer font-heading text-[clamp(0.8rem,1.4vw,0.9rem)] font-medium uppercase tracking-[0.28em] text-ink transition-colors duration-300 ease-out hover:text-gold-deep sm:tracking-[0.26em]"
        >
          World of KHEM
          <span aria-hidden="true" className="ms-3">
            →
          </span>
        </button>

        <button
          ref={circleButton}
          type="button"
          onClick={() => open("circle", circleButton.current)}
          className="khem-cover-link khem-cover-focus cursor-pointer text-[0.7rem] font-medium uppercase tracking-[0.22em] text-ink-muted transition-colors duration-300 ease-out hover:text-gold-deep"
        >
          Join the Inner Circle
        </button>
      </div>
    );
  }

  return (
    <div ref={panelRef} className="khem-rise flex w-full flex-col items-center">
      {panel === "world" ? (
        <nav aria-label="World of KHEM">
          <ul className="flex flex-col items-center gap-5">
            {WORLD_LINKS.map((link, index) => (
              <li
                key={link.href}
                className="khem-rise"
                /*
                 * A 60ms stagger, declared here rather than in the stylesheet
                 * because the delay is a property of this list's order. The cast
                 * is React's requirement for a custom property in `style`, not a
                 * type escape: the value is a string literal built above.
                 */
                style={
                  { "--rise-delay": `${index * 60}ms` } as React.CSSProperties
                }
              >
                {/*
                 * A plain anchor, not `<LocaleLink>`: the cover renders outside
                 * the i18n provider that component reads, and these are English
                 * URLs by definition while the copy is English. It is also a full
                 * document load, which is correct — it leaves the cover's root
                 * layout for the application's.
                 */}
                <a
                  href={link.href}
                  className="khem-cover-link khem-cover-focus font-heading text-[clamp(0.78rem,1.3vw,0.88rem)] font-medium uppercase tracking-[0.25em] text-ink no-underline transition-colors duration-300 ease-out hover:text-gold-deep"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <PrelaunchSubscribe labels={subscribeLabels} />
      )}

      <button
        type="button"
        onClick={() => setPanel("idle")}
        className="khem-cover-focus mt-9 cursor-pointer text-[0.62rem] uppercase tracking-[0.24em] text-ink-subtle transition-colors duration-300 ease-out hover:text-ink"
      >
        Close
      </button>
    </div>
  );
}
