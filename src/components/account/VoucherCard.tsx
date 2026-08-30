import CopyCodeButton from "@/src/components/account/CopyCodeButton";
import Price from "@/src/components/ecommerce/Price";
import { formatAccountDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { CustomerVoucher } from "@/src/types/voucher";

/**
 * One voucher, as a privilege rather than a coupon.
 *
 * A Server Component: it renders a record. The two islands inside it are
 * `<CopyCodeButton>`, which needs the clipboard, and `<Price>`, which needs the
 * visitor's resolved display currency.
 *
 * **A voucher that cannot be used says so and cannot be copied.** The card
 * dims, the chip names the reason, and the copy button is disabled — because a
 * code one keystroke from the checkout field is a code the customer reasonably
 * expects to work, and the panel knows it will not.
 *
 * The benefit is stated as the *rule* — "15% OFF", "EGP 200 OFF" — never as a
 * saving. What a code takes off depends on the bag, and `resolve_discount()`
 * computes that inside the transaction that writes the order. A number here
 * would be a second opinion on money.
 *
 * The code is an LTR island: an uppercase Latin string whose character order is
 * the whole of its meaning, and which must be read the same way in both trees.
 */

export interface VoucherCardProps {
  voucher: CustomerVoucher;
  locale: Locale;
  dict: Dictionary["account"]["vouchers"]["list"];
}

/** The dated line beneath the benefit, chosen by what has become of it. */
function dateLine(
  voucher: CustomerVoucher,
  locale: Locale,
  dict: VoucherCardProps["dict"],
): string {
  const on = (iso: string) => formatAccountDate(iso, locale);

  switch (voucher.status) {
    case "USED":
      return voucher.usedAt ? interpolate(dict.used, { date: on(voucher.usedAt) }) : dict.status.USED;
    case "EXPIRED":
      return voucher.expiresAt
        ? interpolate(dict.expired, { date: on(voucher.expiresAt) })
        : dict.status.EXPIRED;
    case "SCHEDULED":
      return voucher.startsAt
        ? interpolate(dict.opens, { date: on(voucher.startsAt) })
        : dict.status.SCHEDULED;
    default:
      return voucher.expiresAt
        ? interpolate(dict.expires, { date: on(voucher.expiresAt) })
        : dict.noExpiry;
  }
}

export default function VoucherCard({ voucher, locale, dict }: VoucherCardProps) {
  const isAvailable = voucher.status === "AVAILABLE";
  const isSpent = voucher.status === "USED" || voucher.status === "EXPIRED";

  return (
    <article
      className={[
        "flex flex-col gap-6 border px-6 py-7 sm:px-8 sm:py-8",
        "transition-colors duration-500 ease-luxury-bezier",
        isAvailable
          ? "border-ground-accent/25 bg-gold/6"
          : "border-ground-border bg-stone",
        isSpent ? "opacity-55" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p
            {...ltrIsland(locale)}
            className={[
              "mb-2 font-heading text-xl tracking-[0.18em] sm:text-2xl",
              isAvailable ? "text-ground-accent" : "text-ground-muted",
            ].join(" ")}
          >
            {voucher.code}
          </p>

          <p className="flex flex-wrap items-baseline gap-1.5 font-heading text-sm text-ground">
            {voucher.kind === "PERCENTAGE" ? (
              interpolate(dict.percentOff, { value: String(voucher.value) })
            ) : (
              <>
                <Price cents={voucher.value} />
                <span>{dict.off}</span>
              </>
            )}
          </p>
        </div>

        <span
          className={[
            "shrink-0 border px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.16em]",
            isAvailable
              ? "border-ground-accent/40 text-ground-accent"
              : "border-ground-border text-ground-muted",
          ].join(" ")}
        >
          {dict.status[voucher.status]}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 text-[12px] leading-relaxed text-ground-muted">
        {voucher.description ? (
          <p className="text-ground-muted" dir="auto">
            {voucher.description}
          </p>
        ) : null}

        <p>{dict.scope[voucher.appliesTo]}</p>

        {voucher.minimumOrderInCents > 0 ? (
          <p className="flex flex-wrap items-baseline gap-1.5">
            <span>{dict.minimum}</span>
            <Price cents={voucher.minimumOrderInCents} className="text-ground-muted" />
          </p>
        ) : null}

        <p>{dateLine(voucher, locale, dict)}</p>
      </div>

      <CopyCodeButton code={voucher.code} disabled={!isAvailable} />
    </article>
  );
}
