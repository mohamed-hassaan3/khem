"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

/**
 * One collapsible group inside the footer's Collections column — desktop only.
 *
 * ## Why this is not `<FooterGroup>`
 *
 * `<FooterGroup>` is the *column*: it discloses on a phone and is a plain
 * heading with an open list from `md` up. This is a group **inside** that
 * column's desktop list, and it does the opposite — it exists only from `md`
 * up, because below `md` the column is already a disclosure and a disclosure
 * inside a disclosure is a menu, not a footer. The caller renders it in the
 * `hidden md:flex` list, so it never reaches a phone at all.
 *
 * ## The interaction is the Nav's
 *
 * Chevron rotating 180°, a panel animating between `grid-rows-[0fr]` and
 * `[1fr]` on `--ease-luxury-bezier`, `inert` while closed so the links inside
 * are not tab stops. That is the shape `<CollectionsColumn>` in `src/components/
 * Nav.tsx` already uses for these exact groups, and reusing it is what makes
 * the footer feel like the menu rather than like a second idea about
 * disclosure. No spring, no bounce — AGENTS.md §2.2.
 *
 * `grid-rows` rather than `height: auto` because the panel's height is not
 * known: a row transition interpolates from `0fr` to `1fr` and the browser
 * resolves the content height itself, which `max-height` can only approximate
 * with a magic number that clips on the day a collection is added.
 *
 * ## Closed by default
 *
 * The column is fifteen destinations long, which was the complaint. A control
 * that opens something already open shortens nothing; the group labels still
 * print the structure, so nothing is hidden that the reader cannot see is
 * there. Each group is independent — opening one does not close another, which
 * is where this parts company with the Nav's single-`openGroup` column: the
 * Nav is a menu you are passing through, this is a sitemap you are scanning.
 */

export interface FooterDisclosureProps {
  title: string;
  children: React.ReactNode;
  /** Opens on first paint. Left off everywhere so far — see above. */
  defaultOpen?: boolean;
}

export default function FooterDisclosure({
  title,
  children,
  defaultOpen = false,
}: FooterDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full cursor-pointer items-center justify-between gap-3 text-start font-body text-[10px] uppercase tracking-[0.2em] transition-colors duration-300 ${
          open
            ? "text-ground-accent"
            : "text-ground-muted/70 hover:text-ground-accent"
        }`}
      >
        {title}
        <ChevronDown
          aria-hidden="true"
          width={13}
          height={13}
          strokeWidth={1.25}
          className={`shrink-0 transition-transform duration-400 ease-luxury-bezier ${
            open ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>

      <div
        id={panelId}
        inert={!open}
        className={`grid transition-all duration-400 ease-luxury-bezier ${
          open ? "mt-3.5 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
        }`}
      >
        {/* `overflow-hidden` is what lets the `0fr` row clip its content. */}
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3.5">{children}</div>
        </div>
      </div>
    </div>
  );
}
