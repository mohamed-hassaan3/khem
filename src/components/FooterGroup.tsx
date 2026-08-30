"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";

/**
 * One navigation group in the footer — §25.
 *
 * ## Two renderings, not one responsive one
 *
 * On a phone the group is a disclosure: a `<button>` with the label, a `+`/`−`,
 * and a panel that opens. From `md` up it is a plain heading over an always-open
 * list, because at that width the groups are columns sitting side by side and
 * there is no length to save.
 *
 * The heading is therefore rendered **twice** — once as a button (`md:hidden`),
 * once as static text (`hidden md:block`) — rather than once as a button that
 * stops behaving like one at `md`. That alternative is what it looks like it
 * should be, and it is an accessibility bug: the button keeps its role and its
 * `aria-expanded="false"` on desktop, so a screen reader announces a collapsed
 * disclosure over a list that is plainly visible. Duplicating twelve characters
 * of label is the cheaper problem.
 *
 * ## Why not `<details>`
 *
 * It would need no JavaScript, which is the right instinct. But `open` is a
 * boolean attribute and cannot be made responsive: there is no way to render it
 * closed on a phone and open on a desktop from one element, and the UA styling
 * of `::details-content` is not reliably overridable across the browsers this
 * site supports. The panel here is `hidden md:block`, so on desktop it is
 * visible no matter what the mobile state happens to be.
 */

export interface FooterGroupProps {
  title: string;
  children: React.ReactNode;
}

export default function FooterGroup({ title, children }: FooterGroupProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="border-b border-ground-border py-4 md:border-b-0 md:py-0">
      {/* Phone: the disclosure control. */}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className="eyebrow flex w-full cursor-pointer items-center justify-between gap-3 text-start md:hidden"
      >
        {title}
        {open ? (
          <Minus size={14} strokeWidth={1.25} aria-hidden="true" />
        ) : (
          <Plus size={14} strokeWidth={1.25} aria-hidden="true" />
        )}
      </button>

      {/* Desktop: the same words, with no control attached to them. */}
      <p className="eyebrow mb-7 hidden md:block">{title}</p>

      <div
        id={panelId}
        className={`${open ? "block" : "hidden"} pt-4 md:block md:pt-0`}
      >
        {children}
      </div>
    </div>
  );
}
