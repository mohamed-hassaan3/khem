"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Scroll reveal wrapper.
 *
 * ## Why this is no longer Motion, and no longer hidden by default
 *
 * The previous implementation was a `motion.div` with `initial={{ opacity: 0,
 * y: 40 }}` and `whileInView`. That renders `opacity: 0` into the *server*
 * HTML, so every section wrapped in it was invisible until Motion had shipped,
 * hydrated, registered an observer and run a 0.9s animation.
 *
 * For content below the fold that is invisible and harmless. For content in the
 * first viewport it is neither: it makes the largest contentful paint wait on
 * the JavaScript bundle. Measured on the home page under Lighthouse's mobile
 * emulation, first paint landed at ~3.7s and LCP at ~8.8s — a five-second gap
 * in which the page was rendered, styled, and deliberately transparent. This
 * component is used 72 times across the site, so that applied nearly
 * everywhere.
 *
 * ## The shape that fixes it
 *
 * Visible by default. On mount, an element that is still *below* the viewport
 * is hidden and then observed; an element already on screen is left alone and
 * never animates at all.
 *
 * That inverts the failure mode. Without JavaScript, or before it arrives,
 * every section is simply visible — which is the correct answer for a content
 * site, and the reason this needs no `<noscript>` fallback. The animation
 * becomes what it should always have been: an enhancement for content the
 * visitor has not scrolled to yet.
 *
 * The transition itself is CSS (`.reveal` / `.reveal-pending` in
 * `globals.css`), on `--ease-luxury-bezier` — tween only, no spring, no bounce,
 * per AGENTS.md §2.2. It runs on the compositor rather than through a
 * JavaScript animation loop.
 */

/** Matches the `.reveal` transition duration in `globals.css`. */
const TRAVEL_PX = 40;

const TAGS = {
  div: "div",
  section: "section",
  article: "article",
} as const;

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay in seconds. Pass `index * 0.1` for grid children. */
  delay?: number;
  as?: keyof typeof TAGS;
}

export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: RevealProps) {
  const Tag = TAGS[as];
  const ref = useRef<HTMLElement | null>(null);

  /**
   * `true` only for an element that was still below the fold when it mounted
   * and is waiting to be revealed.
   *
   * Deliberately initialised to `false`, not `true`: `true` would render the
   * hidden state on the server and reintroduce exactly the problem this
   * replaces.
   */
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Honoured here rather than through a hook so the element never enters the
    // hidden state at all under a reduced-motion preference — there is nothing
    // to reduce if it was always visible.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /*
     * Already on screen, or above it, when the component mounted. Leave it
     * visible: animating content the visitor is already looking at is the
     * flash this component exists to avoid, and it is the case that was
     * costing the LCP.
     */
    const box = node.getBoundingClientRect();
    if (box.top < window.innerHeight) return;

    setPending(true);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setPending(false);
          // One-shot: the section does not re-hide on the way back up.
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={["reveal", className, pending ? "reveal-pending" : undefined]
        .filter(Boolean)
        .join(" ")}
      style={
        pending
          ? { transform: `translateY(${TRAVEL_PX}px)`, transitionDelay: `${delay}s` }
          : { transitionDelay: `${delay}s` }
      }
    >
      {children}
    </Tag>
  );
}

export default Reveal;
