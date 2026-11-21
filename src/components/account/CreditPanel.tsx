import Price from "@/src/components/ecommerce/Price";
import { formatAccountDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { CustomerCredit } from "@/src/types/credit";

/**
 * One Discovery credit — the wallet instrument with a deadline, so the
 * deadline leads.
 *
 * A spendable credit shows how much of its window is left as a gold bar that
 * drains, with the date and the days remaining beside it. The window is the
 * credit's own (`deliveredAt` → `expiresAt`, 60 days per
 * `supabase/sql/0026_discovery_credits.sql`), never a constant here.
 *
 * `now` is passed in by the page (one clock per render) so every card agrees.
 */
const DAY_MS = 86_400_000;

export interface CreditPanelProps {
  credit: CustomerCredit;
  now: number;
  locale: Locale;
  dict: Dictionary["account"];
}

export default function CreditPanel({ credit, now, locale, dict }: CreditPanelProps) {
  const copy = dict.vouchers.credit;
  const hub = dict.hub.wallet;
  const isAvailable = credit.status === "AVAILABLE";

  let remaining: { days: number; share: number } | null = null;
  if (isAvailable && credit.expiresAt) {
    const end = Date.parse(credit.expiresAt);
    const start = credit.deliveredAt ? Date.parse(credit.deliveredAt) : end - 60 * DAY_MS;
    const span = Math.max(end - start, DAY_MS);
    remaining = {
      days: Math.max(0, Math.ceil((end - now) / DAY_MS)),
      share: Math.min(1, Math.max(0, (end - now) / span)),
    };
  }

  return (
    <article
      className={[
        "acct-card rounded-lg border p-4 sm:p-5",
        isAvailable ? "border-ground-border bg-stone" : "border-ground-border bg-stone/60 opacity-75",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-3">
        <Price cents={credit.amountInCents} className="font-heading text-[22px] text-ground-accent" />
        <span
          className={[
            "inline-flex h-[22px] items-center rounded-full border px-2 text-[9px] uppercase tracking-[0.16em] rtl:text-[11px] rtl:normal-case rtl:tracking-normal",
            isAvailable ? "border-ground-accent/40 text-ground-accent" : "border-ground-border text-ground-muted",
          ].join(" ")}
        >
          {copy.status[credit.status]}
        </span>
      </div>

      {credit.sourceOrderNumber ? (
        <p className="mt-1.5 text-[12px] leading-relaxed text-ground-muted">
          {interpolate(copy.fromOrder, { order: "" })}
          <span {...ltrIsland(locale)}>{credit.sourceOrderNumber}</span>
        </p>
      ) : null}

      {credit.status === "PENDING_DELIVERY" ? (
        <p className="mt-1.5 text-[12px] text-ground-muted">{copy.awaitingDelivery}</p>
      ) : null}

      {remaining && credit.expiresAt ? (
        <div className="mt-3.5">
          <div className="h-1 overflow-hidden rounded-full bg-ground-border">
            <div
              className="acct-bar h-1 rounded-full bg-ground-accent"
              style={{ width: `${Math.round(remaining.share * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-ground rtl:text-[12px]">
            {interpolate(copy.expires, { date: formatAccountDate(credit.expiresAt, locale) })}
            {" · "}
            <span className="text-ground-muted">
              {remaining.days === 1
                ? hub.dayLeft
                : interpolate(hub.daysLeft, { count: String(remaining.days) })}
            </span>
          </p>
        </div>
      ) : null}
    </article>
  );
}
