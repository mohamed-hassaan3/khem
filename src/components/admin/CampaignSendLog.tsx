"use client";

/**
 * Who a sent campaign went to — every address it claimed, whether the mail
 * provider accepted it, and the provider's reason when it did not.
 * (prompts/admin-redesign-stage-6.md, Campaigns — "Who it went to")
 *
 * The rows are already on the page (read server-side for an admin); the CSV is
 * built from them in the browser, so there is no second endpoint handing out
 * the list.
 */

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";

import { SHOP_TIME_ZONE } from "@/src/lib/shop-time";
import type { CampaignRecipientKind, CampaignSendRow } from "@/src/types/campaign";

const PAGE_SIZE = 50;

const KIND_LABEL: Record<CampaignRecipientKind, string> = {
  SUBSCRIBER: "Subscriber",
  CUSTOMER: "Customer",
  SPECIFIC: "Typed by hand",
};

type State = "delivered" | "refused" | "waiting";
type Filter = "all" | State;

function stateOf(row: CampaignSendRow): State {
  if (row.sentAt) return "delivered";
  if (row.error) return "refused";
  return "waiting";
}

function at(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SHOP_TIME_ZONE,
  }).format(new Date(iso));
}

/** Quoted CSV cell, with spreadsheet formula injection neutralised. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export default function CampaignSendLog({
  name,
  rows,
}: {
  /** The campaign's name, for the file name. */
  name: string;
  rows: readonly CampaignSendRow[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const counts = useMemo(() => {
    const by: Record<State, number> = { delivered: 0, refused: 0, waiting: 0 };
    for (const row of rows) by[stateOf(row)] += 1;
    return by;
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (row) => (filter === "all" || stateOf(row) === filter) && (q.length === 0 || row.email.includes(q)),
    );
  }, [rows, query, filter]);

  function download() {
    const lines = [
      ["Email", "List", "Result", "Sent at (UTC)", "Reason"].map(cell).join(","),
      ...rows.map((row) =>
        [
          row.email,
          row.kind ? KIND_LABEL[row.kind] : "",
          { delivered: "Delivered", refused: "Refused", waiting: "Not sent yet" }[stateOf(row)],
          row.sentAt ?? "",
          row.error ?? "",
        ]
          .map(cell)
          .join(","),
      ),
    ];
    const blob = new Blob([`﻿${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `khem-campaign-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "recipients"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: rows.length },
    { key: "delivered", label: "Delivered", count: counts.delivered },
    { key: "refused", label: "Refused", count: counts.refused },
    ...(counts.waiting > 0 ? [{ key: "waiting" as const, label: "Not sent yet", count: counts.waiting }] : []),
  ];

  return (
    <section aria-labelledby="send-log-heading" className="max-w-3xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="send-log-heading" className="font-heading text-[17px] font-normal text-ground">
          Who it went to
        </h2>
        {rows.length > 0 ? (
          <button
            type="button"
            onClick={download}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-ground-border px-3 text-[13px] text-ground transition-colors duration-300 hover:border-gold/40"
          >
            <Download size={14} strokeWidth={1.5} aria-hidden="true" />
            Download CSV
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ground-border px-5 py-6 text-center text-[13px] text-ground-muted">
          No addresses recorded for this campaign.
        </p>
      ) : (
        <>
          <div className="flex h-11 items-center gap-2 rounded-lg border border-ground-border bg-ivory px-3 focus-within:border-gold/60">
            <Search size={15} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-ground-muted" />
            <label htmlFor="send-log-search" className="sr-only">
              Find an email address
            </label>
            <input
              id="send-log-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder="Find an email address"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-ground outline-none placeholder:text-ground-subtle [&::-webkit-search-cancel-button]:hidden"
            />
          </div>

          <div role="tablist" aria-label="Show" className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {filters.map((item) => {
              const on = item.key === filter;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    setFilter(item.key);
                    setLimit(PAGE_SIZE);
                  }}
                  className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors duration-300 ${
                    on ? "border-ground bg-ground text-ground-bg" : "border-ground-border text-ground-muted hover:text-ground"
                  }`}
                >
                  {item.label}
                  <span className={on ? "text-ground-bg/70" : "text-ground-subtle"}>{item.count}</span>
                </button>
              );
            })}
          </div>

          {shown.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-ground-border px-5 py-6 text-center text-[13px] text-ground-muted">
              Nobody matches.
            </p>
          ) : (
            <ul className="mt-3 overflow-hidden rounded-lg border border-ground-border bg-stone">
              {shown.slice(0, limit).map((row) => {
                const state = stateOf(row);
                return (
                  <li
                    key={row.email}
                    className="flex items-start gap-3 border-b border-ground-border px-4 py-3 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span dir="ltr" className="block truncate text-[14px] text-ground">
                        {row.email}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-ground-muted">
                        {row.kind ? KIND_LABEL[row.kind] : "Recipient"}
                        {row.sentAt ? ` · ${at(row.sentAt)}` : ""}
                      </span>
                      {row.error ? (
                        <span className="mt-1 block text-[12px] text-danger">
                          Mail provider: “{row.error}”
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`shrink-0 text-[12px] ${
                        state === "delivered" ? "text-success" : state === "refused" ? "text-danger" : "text-ground-muted"
                      }`}
                    >
                      {state === "delivered" ? "Delivered" : state === "refused" ? "Refused" : "Not sent yet"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {shown.length > limit ? (
            <button
              type="button"
              onClick={() => setLimit((current) => current + PAGE_SIZE)}
              className="mt-3 h-10 w-full cursor-pointer rounded-lg border border-ground-border text-[13px] text-ground transition-colors duration-300 hover:border-gold/40"
            >
              Show {Math.min(PAGE_SIZE, shown.length - limit)} more of {shown.length - limit}
            </button>
          ) : null}

          <p className="mt-2 text-[12px] text-ground-muted">
            “Delivered” means the mail provider accepted the letter for that inbox. Opens are not tracked.
          </p>
        </>
      )}
    </section>
  );
}
