import { Ticket } from "lucide-react";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import Price from "@/src/components/ecommerce/Price";
import { formatAccountDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland, readingArrow } from "@/src/lib/i18n/rtl";
import { ACCOUNT_PATHS } from "@/src/lib/routes";

/**
 * What the house owes this customer, above everything else on the overview.
 *
 * A Server Component: it is handed two figures the vouchers panel has already
 * computed and prints them. `<Price>` is the one island inside it, because the
 * displayed currency is resolved after hydration.
 *
 * ## It is not rendered when there is nothing to say
 *
 * No band reading "0 credits · 0 vouchers". A customer who holds neither is
 * told about the Discovery Set on the panel itself, where there is room to
 * explain what a credit *is*; a gold box announcing nothing at the top of their
 * account is a flourish, and §17 puts usability over drama.
 *
 * ## The expiry is the fact that changes behaviour
 *
 * A credit lapses sixty days after the Discovery Set is delivered
 * (`supabase/sql/0026_discovery_credits.sql`). A balance printed with no date
 * beside it reads as a wallet, which is a different instrument and a promise
 * the checkout would refuse to keep. So the nearest expiry, when there is one,
 * is on the band.
 *
 * Flat, and deliberately so: a reading-edge gold rule on the same `bg-stone`
 * the stat tiles use. No gradient, no glow, no entrance animation — the tone is
 * the boutique's, not a promotion's.
 */

export interface PrivilegeBannerProps {
  creditInCents: number;
  creditCount: number;
  voucherCount: number;
  /** ISO-8601 — the soonest credit expiry, or null when none is dated. */
  expiresAt: string | null;
  locale: Locale;
  dict: Dictionary["account"]["privileges"];
}

export default function PrivilegeBanner({
  creditInCents,
  creditCount,
  voucherCount,
  expiresAt,
  locale,
  dict,
}: PrivilegeBannerProps) {
  // The whole component is conditional on holding something. The caller checks
  // too; this is the guarantee, not the optimisation.
  if (creditCount === 0 && voucherCount === 0) return null;

  return (
    <section className="mb-8 border-s-2 border-gold bg-stone px-6 py-6 sm:px-8 sm:py-7">
      <p className="eyebrow mb-5 flex items-center gap-2 text-[9px]">
        <Ticket size={13} strokeWidth={1.25} aria-hidden="true" />
        {dict.eyebrow}
      </p>

      <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
        {creditCount > 0 ? (
          <div>
            <p className="mb-1.5 font-heading text-2xl text-ground-accent sm:text-3xl">
              <Price cents={creditInCents} />
            </p>
            <p className="font-heading text-[12px] tracking-[0.08em] text-ground">
              {dict.credit}
            </p>
            <p className="mt-0.5 text-[11px] text-ground-muted/70">
              {creditCount === 1
                ? dict.creditCountOne
                : interpolate(dict.creditCount, { count: String(creditCount) })}
              {expiresAt
                ? ` · ${interpolate(dict.expires, {
                    date: formatAccountDate(expiresAt, locale),
                  })}`
                : null}
            </p>
          </div>
        ) : null}

        {voucherCount > 0 ? (
          <div>
            <p
              {...ltrIsland(locale)}
              className="mb-1.5 font-heading text-2xl tabular-nums text-ground-accent sm:text-3xl"
            >
              {voucherCount}
            </p>
            <p className="font-heading text-[12px] tracking-[0.08em] text-ground">
              {dict.vouchers}
            </p>
            <p className="mt-0.5 text-[11px] text-ground-muted/70">
              {voucherCount === 1
                ? dict.voucherCountOne
                : interpolate(dict.voucherCount, {
                    count: String(voucherCount),
                  })}
            </p>
          </div>
        ) : null}

        <LocaleLink
          href={ACCOUNT_PATHS.vouchers}
          className="ms-auto font-heading text-[10px] tracking-[0.15em] text-ground-accent/70 no-underline transition-colors duration-300 ease-luxury-bezier hover:text-ground-accent"
        >
          {`${dict.view} ${readingArrow(locale)}`}
        </LocaleLink>
      </div>
    </section>
  );
}
