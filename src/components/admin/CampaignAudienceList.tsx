"use client";

/**
 * Who this campaign will write to — every address, before it is sent.
 *
 * The Audience section above chooses whole lists (the Inner Circle, customers,
 * typed addresses); this shows the people those lists resolve to and lets the
 * desk leave any of them out, one at a time or every address shown. A ticked
 * row receives the letter; an unticked one does not.
 *
 * The rows come from `campaign_audience_preview()` (0081), the same set the
 * send claims, and each change goes through `setCampaignExclusion`, which
 * revalidates this page — so the count in the send panel follows at once. The
 * tick moves first (optimistic) and reverts if the server refuses.
 *
 * It lists the audience **as saved**: an Audience switch flipped but not yet
 * saved is not reflected until it is.
 */

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";

import { setCampaignExclusion } from "@/src/actions/admin/campaigns";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type {
  CampaignAudienceMember,
  CampaignRecipientKind,
} from "@/src/types/campaign";

const PAGE_SIZE = 50;

const KIND_LABEL: Record<CampaignRecipientKind, string> = {
  SUBSCRIBER: "Subscriber",
  CUSTOMER: "Customer",
  SPECIFIC: "Typed by hand",
};

type Filter = "all" | CampaignRecipientKind | "excluded";

export default function CampaignAudienceList({
  campaignId,
  members,
}: {
  campaignId: string;
  members: readonly CampaignAudienceMember[];
}) {
  const { toast } = useAdminToast();
  const [isPending, startTransition] = useTransition();

  /** Local truth for the ticks, so a change shows before the round trip. */
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(
    () => new Set(members.filter((member) => member.excluded).map((member) => member.email)),
  );

  // A new server list (after any revalidation) resets the local ticks.
  const [seen, setSeen] = useState(members);
  if (seen !== members) {
    setSeen(members);
    setExcluded(new Set(members.filter((member) => member.excluded).map((member) => member.email)));
  }

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const counts = useMemo(() => {
    const by = { SUBSCRIBER: 0, CUSTOMER: 0, SPECIFIC: 0 } as Record<CampaignRecipientKind, number>;
    for (const member of members) by[member.kind] += 1;
    return by;
  }, [members]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((member) => {
      if (filter === "excluded" && !excluded.has(member.email)) return false;
      if (filter !== "all" && filter !== "excluded" && member.kind !== filter) return false;
      if (q.length === 0) return true;
      return (
        member.email.includes(q) || (member.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [members, query, filter, excluded]);

  const receiving = members.length - excluded.size;

  function change(emails: string[], leaveOut: boolean) {
    if (emails.length === 0) return;
    const before = excluded;
    const next = new Set(excluded);
    for (const email of emails) {
      if (leaveOut) next.add(email);
      else next.delete(email);
    }
    setExcluded(next);

    startTransition(async () => {
      const result = await setCampaignExclusion({
        id: campaignId,
        emails,
        excluded: leaveOut,
      });
      if (!result.ok) setExcluded(before);
      toast(result.message);
    });
  }

  const shownEmails = shown.map((member) => member.email);
  const anyShownIncluded = shown.some((member) => !excluded.has(member.email));
  const anyShownExcluded = shown.some((member) => excluded.has(member.email));

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "Everyone", count: members.length },
    ...(counts.SUBSCRIBER > 0 ? [{ key: "SUBSCRIBER" as const, label: "Subscribers", count: counts.SUBSCRIBER }] : []),
    ...(counts.CUSTOMER > 0 ? [{ key: "CUSTOMER" as const, label: "Customers", count: counts.CUSTOMER }] : []),
    ...(counts.SPECIFIC > 0 ? [{ key: "SPECIFIC" as const, label: "Typed", count: counts.SPECIFIC }] : []),
    { key: "excluded", label: "Left out", count: excluded.size },
  ];

  return (
    <section
      aria-labelledby="audience-list-heading"
      className="rounded-lg border border-ground-border bg-stone/60 px-4 py-5 sm:px-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="audience-list-heading" className="font-heading text-[17px] font-normal text-ground">
          Who will receive it
        </h2>
        <p className="text-[13px] text-ground-muted" aria-live="polite">
          <span className="text-ground">{receiving}</span> of {members.length}{" "}
          {members.length === 1 ? "address" : "addresses"} selected
          {isPending ? " · saving…" : ""}
        </p>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-ground-muted">
        Untick anyone who should not get this letter. The list follows the saved
        audience above; unsubscribed and blocked addresses are never on it.
      </p>

      {members.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-ground-border px-4 py-6 text-center text-[13px] text-ground-muted">
          Nobody yet. Choose an audience above and save it, or type addresses.
        </p>
      ) : (
        <>
          <div className="mt-4 flex h-11 items-center gap-2 rounded-lg border border-ground-border bg-ivory px-3 focus-within:border-gold/60">
            <Search size={15} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-ground-muted" />
            <label htmlFor="audience-search" className="sr-only">
              Find a name or email address
            </label>
            <input
              id="audience-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder="Find a name or email"
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
                  className={[
                    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[13px]",
                    "transition-colors duration-300 ease-luxury-bezier",
                    on
                      ? "border-ground bg-ground text-ground-bg"
                      : "border-ground-border text-ground-muted hover:text-ground",
                  ].join(" ")}
                >
                  {item.label}
                  <span className={on ? "text-ground-bg/70" : "text-ground-subtle"}>{item.count}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!anyShownIncluded || isPending}
              onClick={() =>
                change(shownEmails.filter((email) => !excluded.has(email)), true)
              }
              className="h-9 cursor-pointer rounded-lg border border-ground-border px-3 text-[12px] text-ground transition-colors duration-300 hover:border-gold/40 disabled:cursor-default disabled:opacity-40"
            >
              Leave out all shown
            </button>
            <button
              type="button"
              disabled={!anyShownExcluded || isPending}
              onClick={() => change(shownEmails.filter((email) => excluded.has(email)), false)}
              className="h-9 cursor-pointer rounded-lg border border-ground-border px-3 text-[12px] text-ground transition-colors duration-300 hover:border-gold/40 disabled:cursor-default disabled:opacity-40"
            >
              Include all shown
            </button>
          </div>

          {shown.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-ground-border px-4 py-6 text-center text-[13px] text-ground-muted">
              Nobody matches.
            </p>
          ) : (
            <ul className="mt-3 overflow-hidden rounded-lg border border-ground-border bg-ivory">
              {shown.slice(0, limit).map((member) => {
                const out = excluded.has(member.email);
                const id = `aud-${member.email}`;
                return (
                  <li key={member.email} className="border-b border-ground-border last:border-b-0">
                    <label
                      htmlFor={id}
                      className={`flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2 transition-colors duration-300 hover:bg-stone/60 ${out ? "opacity-60" : ""}`}
                    >
                      <input
                        id={id}
                        type="checkbox"
                        checked={!out}
                        onChange={() => change([member.email], !out)}
                        className="size-5 shrink-0 cursor-pointer accent-[var(--ground-accent)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span dir="ltr" className={`block truncate text-[14px] ${out ? "text-ground-muted line-through" : "text-ground"}`}>
                          {member.email}
                        </span>
                        <span className="block truncate text-[12px] text-ground-muted">
                          {member.name ? `${member.name} · ` : ""}
                          {KIND_LABEL[member.kind]}
                        </span>
                      </span>
                      <span className={`shrink-0 text-[11px] ${out ? "text-danger" : "text-ground-accent"}`}>
                        {out ? "Left out" : "Receives"}
                      </span>
                    </label>
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
        </>
      )}
    </section>
  );
}
