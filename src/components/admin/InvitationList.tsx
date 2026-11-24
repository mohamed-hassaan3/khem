"use client";

/**
 * Every invitation the desk has sent, with what became of it — and the two
 * things that can still be done about one: withdraw it, or send it again.
 * (prompts/admin-redesign-stage-6.md, 6b)
 */

import { useMemo, useState, useTransition } from "react";

import { resendInvitation, withdrawInvitation } from "@/src/actions/admin/invitations";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminInvitation, InvitationState } from "@/src/services/admin/invitations";
import { SHOP_TIME_ZONE } from "@/src/lib/shop-time";

const STATE: Record<InvitationState, { label: string; tone: string }> = {
  pending: { label: "Waiting", tone: "border-gold/50 text-ground-accent" },
  accepted: { label: "Joined", tone: "border-success/40 text-success" },
  revoked: { label: "Withdrawn", tone: "border-ground-border text-ground-muted" },
  expired: { label: "Expired", tone: "border-danger/40 text-danger" },
};

type Filter = "all" | InvitationState;

function sentOn(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: SHOP_TIME_ZONE,
  }).format(new Date(iso));
}

export default function InvitationList({
  invitations,
  registered = [],
}: {
  invitations: readonly AdminInvitation[];
  /** Emails that already have an account (from Customers). */
  registered?: readonly string[];
}) {
  const hasAccount = useMemo(() => new Set(registered), [registered]);
  const { toast } = useAdminToast();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const by: Record<InvitationState, number> = { pending: 0, accepted: 0, revoked: 0, expired: 0 };
    for (const invitation of invitations) by[invitation.status] += 1;
    return by;
  }, [invitations]);

  const shown = invitations.filter(
    (invitation) =>
      (filter === "all" || invitation.status === filter) &&
      invitation.email.includes(query.trim().toLowerCase()),
  );

  function run(id: string, action: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(id);
    startTransition(async () => {
      const outcome = await action();
      toast(outcome.message);
      setBusy(null);
    });
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: invitations.length },
    { key: "pending", label: "Waiting", count: counts.pending },
    { key: "accepted", label: "Joined", count: counts.accepted },
    { key: "expired", label: "Expired", count: counts.expired },
    { key: "revoked", label: "Withdrawn", count: counts.revoked },
  ];

  if (invitations.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-ground-border px-5 py-8 text-center text-[13px] text-ground-muted">
        No invitations yet. Invite someone above and they appear here.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex h-11 max-w-md items-center rounded-lg border border-ground-border bg-ivory px-3 focus-within:border-gold/60">
        <label htmlFor="invitation-search" className="sr-only">
          Find an invited address
        </label>
        <input
          id="invitation-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find an address"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ground outline-none placeholder:text-ground-subtle [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      <div role="tablist" aria-label="Show" className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {filters.map((item) => {
          const on = item.key === filter;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(item.key)}
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
        <p className="rounded-lg border border-dashed border-ground-border px-5 py-6 text-center text-[13px] text-ground-muted">
          Nothing matches.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-ground-border bg-stone">
          {shown.map((invitation) => {
            const { label, tone } = STATE[invitation.status];
            const working = isPending && busy === invitation.id;
            return (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ground-border px-4 py-3 last:border-b-0"
              >
                <span className="min-w-0 flex-1 basis-56">
                  <span dir="ltr" className="block truncate text-[14px] text-ground">
                    {invitation.email}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-ground-muted">
                    Sent {sentOn(invitation.createdAt)} · {invitation.locale === "ar" ? "Arabic" : "English"} letter
                  </span>
                  {invitation.status === "pending" && hasAccount.has(invitation.email) ? (
                    <span className="mt-1 block text-[12px] text-warning">
                      Already has an account — signed up without the invitation. You can withdraw it.
                    </span>
                  ) : null}
                </span>
                <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] ${tone}`}>
                  {label}
                </span>
                {invitation.status !== "accepted" ? (
                  <span className="flex gap-2">
                    {invitation.status === "pending" ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => run(invitation.id, () => withdrawInvitation({ id: invitation.id }))}
                        className="h-9 cursor-pointer rounded-lg border border-ground-border px-3 text-[12px] text-ground transition-colors duration-300 hover:border-danger/50 hover:text-danger disabled:cursor-default disabled:opacity-40"
                      >
                        Withdraw
                      </button>
                    ) : null}
                    {hasAccount.has(invitation.email) ? null : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        run(invitation.id, () =>
                          resendInvitation({ id: invitation.id, email: invitation.email, locale: invitation.locale }),
                        )
                      }
                      className="h-9 cursor-pointer rounded-lg border border-ground-border px-3 text-[12px] text-ground transition-colors duration-300 hover:border-gold/40 disabled:cursor-default disabled:opacity-40"
                    >
                      {working ? "Sending…" : "Send again"}
                    </button>
                    )}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
