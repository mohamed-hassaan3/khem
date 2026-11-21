import CopyButton from "@/src/components/account/CopyButton";
import Price from "@/src/components/ecommerce/Price";
import { formatAccountDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { CustomerVoucher } from "@/src/types/voucher";

/**
 * A voucher, drawn as a ticket: the value on a stub, a perforation, then the
 * code, its terms, and a one-tap copy.
 *
 * Only an `AVAILABLE` voucher can be copied. Every other state keeps its
 * ticket — a customer looking for a code they were given should find it and
 * read *why* it does not apply — but dimmed, with the status in a chip where
 * the button would be.
 *
 * The notches are two discs in the page colour over the perforation's ends;
 * they mirror in Arabic because they are placed with the logical `start`.
 */
export interface VoucherTicketProps {
  voucher: CustomerVoucher;
  locale: Locale;
  dict: Dictionary["account"];
}

function termsLine(voucher: CustomerVoucher, locale: Locale, list: Dictionary["account"]["vouchers"]["list"]): string {
  const date = (iso: string) => formatAccountDate(iso, locale);
  switch (voucher.status) {
    case "USED":
      return voucher.usedAt ? interpolate(list.used, { date: date(voucher.usedAt) }) : list.status.USED;
    case "EXPIRED":
      return voucher.expiresAt ? interpolate(list.expired, { date: date(voucher.expiresAt) }) : list.status.EXPIRED;
    case "SCHEDULED":
      return voucher.startsAt ? interpolate(list.opens, { date: date(voucher.startsAt) }) : list.status.SCHEDULED;
    default:
      return voucher.expiresAt ? interpolate(list.expires, { date: date(voucher.expiresAt) }) : list.noExpiry;
  }
}

export default function VoucherTicket({ voucher, locale, dict }: VoucherTicketProps) {
  const list = dict.vouchers.list;
  const isAvailable = voucher.status === "AVAILABLE";

  return (
    <article
      className={[
        "acct-card relative grid grid-cols-[88px_1fr] overflow-hidden rounded-lg border sm:grid-cols-[104px_1fr]",
        isAvailable ? "border-ground-accent/40 bg-gold/8" : "border-ground-border bg-stone opacity-70",
      ].join(" ")}
    >
      {/* Perforation notches. */}
      <span aria-hidden="true" className="absolute -top-2 start-[81px] size-3.5 rounded-full border border-ground-accent/30 bg-ground-bg sm:start-[97px]" />
      <span aria-hidden="true" className="absolute -bottom-2 start-[81px] size-3.5 rounded-full border border-ground-accent/30 bg-ground-bg sm:start-[97px]" />

      <div className="flex flex-col items-center justify-center border-e border-dashed border-ground-accent/40 px-2 py-4 text-center">
        <span className="font-heading text-[22px] leading-none text-ground-accent sm:text-[26px]">
          {voucher.kind === "PERCENTAGE" ? (
            <span {...ltrIsland(locale)}>{voucher.value}%</span>
          ) : (
            <Price cents={voucher.value} className="text-[16px] sm:text-[19px]" />
          )}
        </span>
        <span className="mt-1.5 text-[9px] uppercase tracking-[0.18em] text-ground-muted rtl:text-[11px] rtl:normal-case rtl:tracking-normal">
          {list.off}
        </span>
      </div>

      <div className="min-w-0 px-4 py-3.5">
        <p {...ltrIsland(locale)} className="break-all font-heading text-[14px] tracking-[0.18em] text-ground rtl:text-right">
          {voucher.code}
        </p>

        <p className="mt-1.5 text-[11px] leading-relaxed text-ground-muted rtl:text-[12px]">
          {voucher.minimumOrderInCents > 0 ? (
            <>
              {list.minimum} <Price cents={voucher.minimumOrderInCents} />
              {" · "}
            </>
          ) : null}
          {termsLine(voucher, locale, list)}
          {voucher.appliesTo !== "ALL" ? ` · ${list.scope[voucher.appliesTo]}` : null}
        </p>

        <div className="mt-2.5">
          {isAvailable ? (
            <CopyButton
              value={voucher.code}
              label={interpolate(list.copyLabel, { code: voucher.code })}
              text={list.copy}
              copiedText={dict.hub.copied}
              failedText={list.copyFailed}
            />
          ) : (
            <span className="inline-flex h-[22px] items-center rounded-full border border-ground-border px-2 text-[9px] uppercase tracking-[0.16em] text-ground-muted rtl:text-[11px] rtl:normal-case rtl:tracking-normal">
              {list.status[voucher.status]}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
