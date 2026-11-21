"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

/**
 * A quiet, 48px row that opens to an optional part of the checkout: the
 * delivery note, a discount code, KHEM Points, a Discovery Credit.
 *
 * Stage 2 (`prompts/storefront-redesign-stage-2.md` D10). A native
 * `<details>` so it works without script and is announced as expandable;
 * kept in React state only so `forceOpen` can open it when it has something
 * to show (a code applied or refused, points chosen, a note already typed),
 * which a closed row would otherwise hide. Purely presentational: what is
 * inside keeps its own logic and props.
 */
export interface CheckoutDisclosureProps {
  title: React.ReactNode;
  /** Opens the row (and keeps it open) while true. */
  forceOpen?: boolean;
  /** Trailing glyph: "+" for an add-on, chevron for a section. */
  glyph?: "plus" | "chevron";
  className?: string;
  children: React.ReactNode;
}

export default function CheckoutDisclosure({
  title,
  forceOpen = false,
  glyph = "plus",
  className = "",
  children,
}: CheckoutDisclosureProps) {
  const [open, setOpen] = useState(false);
  // Derived, not synced: while there is something to show the row is open.
  const isOpen = forceOpen || open;

  return (
    <details
      open={isOpen}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={`group ${className}`}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 text-[13px] text-ground transition-colors duration-300 ease-out hover:text-ground-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ground-accent [&::-webkit-details-marker]:hidden">
        <span dir="auto">{title}</span>
        {glyph === "plus" ? (
          <span
            aria-hidden="true"
            className="text-lg leading-none text-ground-accent transition-transform duration-500 ease-luxury-bezier group-open:rotate-45 motion-reduce:transition-none"
          >
            +
          </span>
        ) : (
          <ChevronDown
            size={16}
            strokeWidth={1.25}
            aria-hidden="true"
            className="text-ground-muted transition-transform duration-500 ease-luxury-bezier group-open:rotate-180 motion-reduce:transition-none"
          />
        )}
      </summary>
      <div className="khem-rise pb-4">{children}</div>
    </details>
  );
}
