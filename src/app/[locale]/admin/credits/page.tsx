import Link from "next/link";

import {
  AdminCell,
  AdminEmpty,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import FilterChips from "@/src/components/admin/FilterChips";
import { egp } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  CREDITS_PER_PAGE,
  getCreditTotals,
  listCredits,
} from "@/src/services/admin/credits";
import type { CreditStatus } from "@/src/types/credit";

/**
 * The Discovery Credit ledger.
 *
 * Read-only but for one lever. Every credit here exists because an order event
 * put it there — a payment cleared, a parcel arrived, sixty days passed, a
 * refund was made — and each of those writes happens inside the SQL function
 * that performs the event. A button that minted a credit would create a second
 * way for one to exist, and the ledger would stop describing what happened.
 *
 * The figure worth watching is **Pending delivery**: those customers hold a
 * credit they cannot spend, because nobody has marked their Discovery Set
 * delivered. Nothing else on the site would ever say so.
 */
export const dynamic = "force-dynamic";

const STATUSES: readonly CreditStatus[] = [
  "PENDING_DELIVERY",
  "AVAILABLE",
  "REDEEMED",
  "EXPIRED",
  "CANCELLED",
];

const STATUS_LABELS: Record<CreditStatus, string> = {
  PENDING_DELIVERY: "Pending delivery",
  AVAILABLE: "Available",
  REDEEMED: "Redeemed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

function readParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
}

function readPage(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(readParam(value), 10);
  return Number.isFinite(parsed) && parsed > 1 ? parsed : 1;
}

function stamp(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function pageHref(
  basePath: string,
  query: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (key === "page" || value === undefined) continue;
    params.set(key, Array.isArray(value) ? (value[0] ?? "") : value);
  }

  if (page > 1) params.set("page", String(page));

  const search = params.toString();
  return search.length > 0 ? `${basePath}?${search}` : basePath;
}

function Figure({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string | number;
  note?: string;
  tone?: "warning";
}) {
  return (
    <div
      className={`border p-6 sm:p-8 ${
        tone === "warning"
          ? "border-warning/30 bg-warning/5"
          : "border-ground-border bg-ivory/2"
      }`}
    >
      <p
        className={`font-heading text-[10px] uppercase tracking-[0.2em] ${
          tone === "warning" ? "text-warning" : "text-ground-muted"
        }`}
      >
        {label}
      </p>
      <p className="mt-4 font-heading text-3xl tracking-[0.1em] text-ground-accent sm:text-4xl">
        {value}
      </p>
      {note ? <p className="mt-3 text-[11px] text-ground-muted">{note}</p> : null}
    </div>
  );
}

export default async function AdminCreditsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const page = readPage(query.page);
  const statusParam = readParam(query.status);
  const status = STATUSES.find((value) => value === statusParam);

  const [{ credits, total }, totals] = await Promise.all([
    listCredits({
      status,
      offset: (page - 1) * CREDITS_PER_PAGE,
      limit: CREDITS_PER_PAGE,
    }),
    getCreditTotals(),
  ]);

  const basePath = localizePath(activeLocale, "/admin/credits");
  const lastPage = Math.max(1, Math.ceil(total / CREDITS_PER_PAGE));

  return (
    <>
      <AdminPageHeader
        title="Discovery Credits"
        description="Every credit a Discovery Set has earned. Credits are created, activated and expired by order events — this screen records them, and the only thing it can change is an adjustment, which is itself written to the ledger."
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Figure
          label="Issued"
          value={totals.issuedCount}
          note={egp(totals.issuedInCents)}
        />
        <Figure
          label="Available"
          value={totals.availableCount}
          note={egp(totals.availableInCents)}
        />
        <Figure
          label="Redeemed"
          value={totals.redeemedCount}
          note={egp(totals.redeemedInCents)}
        />
        <Figure
          label="Pending delivery"
          value={totals.pendingDeliveryCount}
          note={
            totals.pendingDeliveryCount > 0
              ? "Unspendable until the Set is delivered"
              : "Nothing waiting"
          }
          tone={totals.pendingDeliveryCount > 0 ? "warning" : undefined}
        />
      </div>

      <div className="mt-8">
        <FilterChips
          basePath={basePath}
          param="status"
          active={status ?? ""}
          query={query}
          chips={[
            { value: "", label: "Every credit" },
            ...STATUSES.map((value) => ({
              value,
              label: STATUS_LABELS[value],
            })),
          ]}
        />
      </div>

      {credits.length === 0 ? (
        <AdminEmpty
          message={
            status
              ? "No credits in that state."
              : "No credits yet. One is earned the moment a Discovery Set is paid for by a customer with an account."
          }
        />
      ) : (
        <>
          <AdminTable
            headers={[
              "Credit",
              "Worth",
              "Balance",
              "Status",
              "Expires",
              { label: "Open", hidden: true },
            ]}
          >
            {credits.map((credit) => (
              <AdminRow key={credit.id}>
                <AdminCell>
                  <span className="block font-heading text-[11px] tracking-[0.1em]">
                    {credit.id.slice(0, 8)}
                  </span>
                  <span className="mt-1 block text-[10px] tracking-wide text-ground-subtle">
                    earned {stamp(credit.earnedAt)}
                  </span>
                </AdminCell>

                <AdminCell>{egp(credit.amountInCents)}</AdminCell>

                <AdminCell muted>{egp(credit.balanceInCents)}</AdminCell>

                <AdminCell>
                  <span
                    className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] ${
                      credit.status === "AVAILABLE"
                        ? "border-success/40 text-success"
                        : credit.status === "PENDING_DELIVERY"
                          ? "border-warning/40 text-warning"
                          : credit.status === "REDEEMED"
                            ? "border-gold/40 text-ground-accent"
                            : "border-ground-border text-ground-muted"
                    }`}
                  >
                    {STATUS_LABELS[credit.status]}
                  </span>
                </AdminCell>

                <AdminCell muted>{stamp(credit.expiresAt)}</AdminCell>

                <AdminCell>
                  <Link
                    href={`${basePath}/${credit.id}`}
                    className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                  >
                    Open
                  </Link>
                </AdminCell>
              </AdminRow>
            ))}
          </AdminTable>

          {lastPage > 1 ? (
            <nav
              aria-label="Pagination"
              className="mt-8 flex items-center justify-between gap-4"
            >
              {page > 1 ? (
                <Link
                  href={pageHref(basePath, query, page - 1)}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}

              <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
                Page {page} of {lastPage}
              </span>

              {page < lastPage ? (
                <Link
                  href={pageHref(basePath, query, page + 1)}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
