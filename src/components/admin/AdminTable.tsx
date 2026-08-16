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
    <header className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-border pb-6">
      <div>
        <h1 className="font-heading text-2xl uppercase tracking-[0.2em] text-ivory">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-ivory/40">
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
      className="inline-flex items-center gap-2 rounded-none border border-gold/40 px-6 py-3 font-heading text-[10px] uppercase tracking-[0.2em] text-gold transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-gold hover:bg-gold/10"
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
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[720px] border-collapse text-start">
        <thead>
          <tr className="border-b border-border bg-ivory/2">
            {headers.map((header) => {
              const label = headerLabel(header);
              const hidden = typeof header !== "string";

              return (
                <th
                  key={label}
                  scope="col"
                  className="px-5 py-4 text-start font-heading text-[9px] uppercase tracking-[0.2em] text-ivory/30"
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
    <tr className="border-b border-border last:border-b-0 transition-colors duration-300 hover:bg-ivory/3">
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
      className={`px-5 py-4 align-middle text-[12px] tracking-wide ${
        muted ? "text-ivory/35" : "text-ivory/80"
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
      className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] ${
        live ? "border-gold/40 text-gold" : "border-border text-ivory/30"
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
    <div className="border border-border px-8 py-16 text-center">
      <p className="text-[12px] tracking-wide text-ivory/35">{message}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
