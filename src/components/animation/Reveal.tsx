"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Scroll reveal wrapper.
 *
 * Motion lives behind this boundary: `motion/react-client` does not carry a
 * "use client" directive in motion@13, so Motion is never imported directly
 * into a Server Component. Children are passed through untouched, which means a
 * server-rendered subtree stays server-rendered inside this client wrapper.
 *
 * Motion config follows AGENTS.md §2.2 — tween only, on the `--ease-luxury-bezier`
 * curve. No spring, no bounce.
 */

/** The `--ease-luxury-bezier` token expressed as a cubic-bezier tuple. */
const EASE_LUXURY: [number, number, number, number] = [0.16, 1, 0.3, 1];

const DURATION_SECONDS = 0.9;
const TRAVEL_PX = 40;

const MOTION_TAGS = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
} as const;

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay in seconds. Pass `index * 0.1` for grid children. */
  delay?: number;
  as?: keyof typeof MOTION_TAGS;
}

export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: RevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const Tag = MOTION_TAGS[as];

  // Reduced motion: render the final state immediately, no transition at all.
  if (prefersReducedMotion) {
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: TRAVEL_PX }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1, margin: "0px 0px -60px 0px" }}
      transition={{ duration: DURATION_SECONDS, ease: EASE_LUXURY, delay }}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
