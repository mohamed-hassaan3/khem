import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import CreditAdjustForm from "@/src/components/admin/CreditAdjustForm";
import { egp } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getCredit } from "@/src/services/admin/credits";
import type { CreditTransactionKind } from "@/src/types/credit";

/**
 * One credit, and everything that has happened to it.
 *
 * The trail is the record. The balance printed above it is the sum of the rows
 * below it and is stored nowhere — if the two ever appeared to disagree, the
 * rows would be right, because the number is computed from them.
 */
export const dynamic = "force-dynamic";

const KIND_LABELS: Record<CreditTransactionKind, string> = {
  EARNED: "Earned",
  USED: "Redeemed",
  REFUNDED: "Restored",
  EXPIRED: "Expired",
  ADJUSTED: "Adjusted",
};

function stamp(iso: string | null, withTime = false): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit" as const, minute: "2-digit" as const } : {}),
    timeZone: "UTC",
  }).format(new Date(iso));
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-ground-border py-3 last:border-b-0">
      <dt className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
        {term}
      </dt>
      <dd className="mt-1.5 text-[12px] tracking-wide text-ground">{children}</dd>
    </div>
  );
}

export default async function AdminCreditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const credit = await getCredit(decodeURIComponent(id));
  if (!credit) notFound();

  const listPath = localizePath(activeLocale, "/admin/credits");
  const ordersPath = localizePath(activeLocale, "/admin/orders");

  return (
    <>
      <Link
        href={listPath}
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
      >
        <ArrowLeft size={13} strokeWidth={1.25} />
        All credits
      </Link>

      <AdminPageHeader
        title={egp(credit.amountInCents)}
        description={`Discovery credit · earned ${stamp(credit.earnedAt)}${
          credit.customerName ? ` · ${credit.customerName}` : ""
        }`}
      />

      <div className="grid gap-5 md:gap-8 xl:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          {/* ── The ledger ─────────────────────────────── */}
          <section>
            <h2 className="mb-5 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
              The ledger
            </h2>

            <ul className="space-y-3">
              {credit.transactions.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 border border-ground-border p-4 sm:p-5"
                >
                  <div>
                    <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
                      {KIND_LABELS[entry.kind]}
                    </span>
                    <span className="ms-3 text-[11px] tracking-wide text-ground-subtle">
                      {stamp(entry.occurredAt, true)}
                    </span>
                    {entry.note ? (
                      <span className="mt-2 block text-[12px] leading-relaxed text-ground-muted">
                        {entry.note}
                      </span>
                    ) : null}
                    {entry.actor ? (
                      <span className="mt-1 block text-[11px] text-ground-subtle">
                        by {entry.actor}
                      </span>
                    ) : null}
                  </div>

                  <span
                    className={`font-heading text-[13px] tracking-[0.1em] ${
                      entry.amountInCents > 0 ? "text-success" : "text-ground-muted"
                    }`}
                  >
                    {entry.amountInCents > 0 ? "+" : "−"}
                    {egp(Math.abs(entry.amountInCents))}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-5 text-[11px] leading-relaxed text-ground-subtle">
              Append-only. A correction is a new row, never a change to one
              above — which is what lets this list be trusted as the record.
            </p>
          </section>

          {/* ── Adjust ─────────────────────────────────── */}
          <section>
            <h2 className="mb-5 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
              Record an adjustment
            </h2>

            <CreditAdjustForm creditId={credit.id} />
          </section>
        </div>

        {/* ── The record ───────────────────────────────── */}
        <aside className="space-y-8">
          <div className="border border-ground-border p-5 sm:p-6">
            <h2 className="mb-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
              Standing
            </h2>
            <dl>
              <Detail term="Balance">
                <span className="font-heading text-lg tracking-[0.1em] text-ground-accent">
                  {egp(credit.balanceInCents)}
                </span>
              </Detail>
              <Detail term="Status">{credit.status.replace("_", " ").toLowerCase()}</Detail>
              <Detail term="Set delivered">{stamp(credit.deliveredAt)}</Detail>
              <Detail term="Expires">{stamp(credit.expiresAt)}</Detail>
            </dl>
            {credit.deliveredAt === null ? (
              <p className="mt-4 text-[11px] leading-relaxed text-warning">
                The Discovery Set has not been marked delivered, so the sixty
                days have not started and this credit cannot be spent.
              </p>
            ) : null}
          </div>

          <div className="border border-ground-border p-5 sm:p-6">
            <h2 className="mb-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
              Earned on
            </h2>
            <dl>
              <Detail term="Order">
                {credit.sourceOrderNumber ? (
                  <Link
                    href={`${ordersPath}/${credit.sourceOrderNumber}`}
                    className="text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                  >
                    {credit.sourceOrderNumber}
                  </Link>
                ) : (
                  "—"
                )}
              </Detail>
              <Detail term="Customer">{credit.customerName ?? "—"}</Detail>
              <Detail term="Email">{credit.customerEmail ?? "—"}</Detail>
            </dl>
            <p className="mt-4 text-[11px] leading-relaxed text-ground-subtle">
              A credit belongs to the account that bought the Set and is not
              transferable.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
