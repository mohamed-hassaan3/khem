import { ChevronRight } from "lucide-react";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import Price from "@/src/components/ecommerce/Price";
import { formatAccountDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { ACCOUNT_PATHS } from "@/src/lib/routes";

/**
 * The membership card — everything the house holds for this customer, at a
 * glance, in the one obsidian object on an ivory page.
 *
 * Every figure is real and read by the Wallet's own services, so the card and
 * the Wallet it opens can never disagree:
 *  - points: `rewardsForUser().balancePoints` — the column is omitted entirely
 *    while the rewards programme is switched off, rather than reading "0";
 *  - credit: `creditLedgerForUser().availableInCents`;
 *  - vouchers: the count of `AVAILABLE` vouchers.
 *
 * The footer states the soonest credit expiry, because it is the one fact on
 * the card that should change what the customer does this week.
 *
 * Motion: a slow gold sheen crosses the card on hover/focus (`.acct-sheen`),
 * and the card lifts 2px. Both are off under reduced motion.
 */
export interface MemberCardProps {
  name: string;
  /** The account has no name, so `name` is an email: set it in the body face, as written. */
  nameIsEmail: boolean;
  points: number | null;
  creditInCents: number;
  vouchers: number;
  /** ISO-8601, the soonest expiry over spendable credits. */
  creditExpiresAt: string | null;
  locale: Locale;
  dict: Dictionary["account"]["hub"];
}

function Figure({
  value,
  label,
  first,
}: {
  value: React.ReactNode;
  label: string;
  first: boolean;
}) {
  return (
    <div className={first ? "min-w-0" : "min-w-0 border-s border-gold/25 ps-3.5"}>
      <p className="truncate font-heading text-[18px] leading-tight text-gold-soft lg:text-[20px]">
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-dim rtl:text-[11px] rtl:normal-case rtl:tracking-normal">
        {label}
      </p>
    </div>
  );
}

export default function MemberCard({
  name,
  nameIsEmail,
  points,
  creditInCents,
  vouchers,
  creditExpiresAt,
  locale,
  dict,
}: MemberCardProps) {
  const figures = [
    ...(points === null
      ? []
      : [{ key: "points", label: dict.points, value: <span {...ltrIsland(locale)}>{points.toLocaleString("en-US")}</span> }]),
    { key: "credit", label: dict.credit, value: <Price cents={creditInCents} /> },
    { key: "vouchers", label: dict.vouchers, value: <span {...ltrIsland(locale)}>{vouchers}</span> },
  ];

  return (
    <LocaleLink
      href={ACCOUNT_PATHS.vouchers}
      aria-label={dict.openWalletLabel}
      className="acct-sheen group relative flex h-full flex-col overflow-hidden rounded-xl border border-gold/45 bg-[radial-gradient(120%_90%_at_100%_0%,#2a241c_0%,#121110_55%,#0d0d0d_100%)] p-5 text-ivory no-underline shadow-[0_18px_40px_-24px_rgba(13,13,13,0.55)] transition-[transform,box-shadow] duration-700 ease-luxury-bezier hover:-translate-y-0.5 hover:shadow-[0_26px_50px_-24px_rgba(13,13,13,0.6)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ground-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0 rtl:bg-[radial-gradient(120%_90%_at_0%_0%,#2a241c_0%,#121110_55%,#0d0d0d_100%)] lg:p-7"
    >
      <div className="flex items-center justify-between">
        <span className="font-heading text-[13px] tracking-[0.32em] text-gold-soft">KHEM</span>
        <span className="text-[9px] uppercase tracking-[0.3em] text-dim rtl:text-[11px] rtl:normal-case rtl:tracking-normal">
          {dict.member}
        </span>
      </div>

      <p
        {...(nameIsEmail ? ltrIsland(locale) : {})}
        className={[
          "mb-auto mt-6 truncate lg:mt-8 rtl:text-right",
          // An email in Cinzel capitals is unreadable as an address.
          nameIsEmail
            ? "font-body text-[14px] tracking-[0.04em] lg:text-[15px]"
            : "font-heading text-[15px] uppercase tracking-[0.16em] lg:text-[17px] rtl:normal-case rtl:tracking-normal rtl:text-[19px]",
        ].join(" ")}
      >
        {name}
      </p>

      <div
        className="mt-5 grid border-t border-gold/30 pt-3.5"
        style={{ gridTemplateColumns: `repeat(${figures.length}, minmax(0, 1fr))` }}
      >
        {figures.map((figure, index) => (
          <Figure key={figure.key} value={figure.value} label={figure.label} first={index === 0} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-dim rtl:text-[12px]">
        <span className="truncate">
          {creditExpiresAt
            ? interpolate(dict.creditExpires, { date: formatAccountDate(creditExpiresAt, locale) })
            : null}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-gold-soft rtl:text-[12px] rtl:normal-case rtl:tracking-normal">
          {dict.openWallet}
          <ChevronRight
            size={13}
            strokeWidth={1.5}
            aria-hidden="true"
            className="transition-transform duration-500 ease-luxury-bezier group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
          />
        </span>
      </div>
    </LocaleLink>
  );
}
