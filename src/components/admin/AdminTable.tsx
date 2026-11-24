/**
 * Table primitives and the page header the dashboard screens share.
 *
 * A Server Component — none of this is interactive, and rendering it on the
 * server keeps the list pages free of a client bundle they do not need.
 *
 * The horizontal scroll lives on the table's own wrapper rather than the page:
 * a product row carries eight columns, and a body that scrolls sideways makes
 * the rail and the header slide off too.
 */

import Link from "next/link";
import type { ReactNode } from "react";

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4 md:mb-8 md:gap-6">
      {/*
        `min-w-0` so a long order number wraps instead of widening the panel
        past the viewport — the flex item would otherwise take its content's
        intrinsic width and push the page into a horizontal scroll.
      */}
      <div className="min-w-0">
        <h1 className="font-heading text-[26px] font-normal leading-[1.1] text-ground wrap-break-word lg:text-[32px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ground-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

/** The gold-bordered call to action that opens a create form. */
export function AdminLinkButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center gap-2 rounded-lg bg-ground px-5 text-[13px] text-ground-bg no-underline transition-colors duration-300 ease-luxury-bezier hover:bg-ground/85"
    >
      {children}
    </Link>
  );
}

/**
 * A column heading.
 *
 * The object form exists for the action columns at the end of a table. They
 * used to be passed as `""`, which cost two things at once: React saw two
 * children keyed alike (the empty string is not a unique key), and a screen
 * reader met two columns with no name at all. A hidden *label* fixes both — the
 * column keeps its accessible name and the key stays unique, while the design
 * keeps its blank corner.
 */
export type AdminHeader = string | { label: string; hidden: true };

/** djb2, base 36 — a short stable class name from a table's column labels. */
function hash(text: string): string {
  let value = 5381;
  for (let index = 0; index < text.length; index += 1) {
    value = ((value << 5) + value + text.charCodeAt(index)) | 0;
  }
  return (value >>> 0).toString(36);
}

function headerLabel(header: AdminHeader): string {
  return typeof header === "string" ? header : header.label;
}

export function AdminTable({
  headers,
  children,
}: {
  headers: readonly AdminHeader[];
  children: ReactNode;
}) {
  /*
   * Phones (below `md`): every row is a card and every cell a "Label  value"
   * line, the label drawn by `::before` from the column's header. The rules
   * are generated here, scoped to this table, so the 28 screens that use it
   * change nothing — the 720px minimum and its sideways scroll are now a
   * tablet-and-up layout only (prompts/admin-redesign-stage-6.md).
   *
   * The scope is a hash of the labels: deterministic on the server, and two
   * tables with the same columns would share identical rules anyway.
   */
  const labels = headers.map(headerLabel);
  const scope = `at-${hash(labels.join("|"))}`;
  const rules = headers
    .map((header, index) =>
      typeof header === "string" && header.trim().length > 0
        ? `.${scope} td:nth-child(${index + 1})::before{content:${JSON.stringify(header)}}`
        : // An action column (unnamed): its buttons sit side by side on one
          // line at the foot of the card instead of a row each.
          `.${scope} td:nth-child(${index + 1}){display:inline-flex;border-top:0;margin-inline-end:.75rem}` +
          `.${scope} td:nth-child(${index + 1})::before{display:none}`,
    )
    .join("");

  return (
    <div className={`admin-table ${scope} md:overflow-x-auto md:rounded-lg md:border md:border-ground-border`}>
      <style>{`@media (max-width:767.98px){${rules}}`}</style>
      <table className="w-full border-collapse text-start md:min-w-[720px]">
        <thead className="max-md:sr-only">
          <tr className="border-b border-ground-border bg-stone">
            {headers.map((header) => {
              const label = headerLabel(header);
              const hidden = typeof header !== "string";

              return (
                <th
                  key={label}
                  scope="col"
                  className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-[0.12em] text-ground-muted"
                >
                  <span className={hidden ? "sr-only" : undefined}>{label}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function AdminRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-ground-border last:border-b-0 transition-colors duration-300 md:hover:bg-stone/60">
      {children}
    </tr>
  );
}

export function AdminCell({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <td
      className={`px-4 py-3.5 align-middle text-[13px] ${
        muted ? "text-ground-muted" : "text-ground"
      }`}
    >
      {children}
    </td>
  );
}

/** Live / archived / draft, as a pill rather than a word in a column of words. */
export function AdminStatus({
  live,
  liveLabel = "Live",
  offLabel = "Archived",
}: {
  live: boolean;
  liveLabel?: string;
  offLabel?: string;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] ${
        live ? "border-gold/40 text-ground-accent" : "border-ground-border text-ground-muted"
      }`}
    >
      {live ? liveLabel : offLabel}
    </span>
  );
}

/**
 * What a list shows before anything exists.
 *
 * Every list has one. An empty table with headers and no rows reads as a
 * failure; a sentence and the button that fixes it reads as a starting point.
 */
export function AdminEmpty({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-ground-border px-5 py-8 text-center md:py-12">
      <p className="text-[13px] text-ground-muted">{message}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

/**
 * "← Products" above an edit or detail screen: the way back to the list it
 * came from, on every screen one level below a section.
 */
export function AdminBackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="mb-5 inline-flex min-h-9 items-center gap-1.5 text-[13px] text-ground-muted no-underline transition-colors duration-300 hover:text-ground-accent"
    >
      <span aria-hidden="true" className="rtl:rotate-180">←</span>
      {children}
    </Link>
  );
}
