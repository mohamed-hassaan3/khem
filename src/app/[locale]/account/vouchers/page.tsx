import { Ticket } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import CreditCard from "@/src/components/account/CreditCard";
import CreditLedger from "@/src/components/account/CreditLedger";
import CreditSummary from "@/src/components/account/CreditSummary";
import VoucherCard from "@/src/components/account/VoucherCard";
import EmptyState from "@/src/components/ecommerce/EmptyState";
import { getViewer } from "@/src/lib/auth";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import { creditLedgerForUser } from "@/src/services/credits";
import { vouchersForUser } from "@/src/services/vouchers";

/**
 * Vouchers & Credits — the privileges panel.
 *
 * Two instruments, kept apart on the page because they are not the same thing.
 * A **KHEM Credit** is earned by a Discovery Set, spent whole against one
 * full-size fragrance, and lapses sixty days after that Set is delivered
 * (`supabase/sql/0026_discovery_credits.sql`). A **voucher** is a campaign code
 * this customer has been granted by name (`supabase/sql/0028_discounts.sql`).
 * Merging them into one "balance" would misdescribe both.
 *
 * `force-dynamic`, like every other panel: everything here belongs to one
 * visitor, and a credit that expired an hour ago must not be served from a
 * cache saying it is available.
 *
 * ## The gate
 *
 * `getViewer()` here, again, beneath the layout's own check — the same belt and
 * braces every panel wears, and the reason `src/proxy.ts` is described as an
 * optimisation rather than the boundary. Both service calls take their identity
 * from that session and from nowhere else: `0026` and `0028` grant the public
 * roles nothing and carry no RLS policy, so those filters *are* the access
 * control. No id on this page ever came from the URL.
 *
 * Nothing here is a permission. `place_order()` re-checks a credit under a row
 * lock and `resolve_discount()` re-weighs a code against the bag being paid
 * for; this panel reports, it does not authorise.
 */
export const dynamic = "force-dynamic";

const PATH = ACCOUNT_PATHS.vouchers;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  return {
    ...localeMetadata({
      locale: activeLocale,
      path: PATH,
      title: dict.account.vouchers.meta.title,
      description: dict.account.vouchers.meta.description,
    }),
    // One customer's privileges. Neither indexed nor crawled onward.
    robots: { index: false, follow: false },
  };
}

export default async function VouchersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, viewer] = await Promise.all([params, getViewer()]);
  const activeLocale = isLocale(locale) ? locale : "en";

  if (viewer === null)
    redirect(signInPathWithReturn(activeLocale, localizePath(activeLocale, PATH)));

  const [dict, ledger, vouchers] = await Promise.all([
    getDictionary(activeLocale),
    creditLedgerForUser(viewer.id),
    // The email is the session's verified primary address — a grant may have
    // been issued before this person ever had an account.
    vouchersForUser({ clerkUserId: viewer.id, email: viewer.primaryEmail }),
  ]);

  const copy = dict.account.vouchers;
  const hasCredits = ledger.credits.length > 0;

  return (
    <div>
      <p className="eyebrow mb-3">{copy.eyebrow}</p>

      <h1 className="mb-8 md:mb-12 font-heading text-3xl font-normal text-ground sm:text-4xl">
        {copy.heading}
      </h1>

      {/* ── KHEM Credit ─────────────────────────────── */}
      <section className="mb-12 md:mb-16">
        <h2 className="mb-6 font-heading text-base text-ground">
          {copy.credit.heading}
        </h2>

        {hasCredits ? (
          <>
            <div className="mb-8">
              <CreditSummary
                availableInCents={ledger.availableInCents}
                availableCount={ledger.availableCount}
                dict={copy.credit}
              />
            </div>

            <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {ledger.credits.map((credit) => (
                <CreditCard
                  key={credit.id}
                  credit={credit}
                  locale={activeLocale}
                  dict={copy.credit}
                />
              ))}
            </div>

            <h2 className="mb-6 font-heading text-base text-ground">
              {copy.ledger.heading}
            </h2>

            <CreditLedger
              entries={ledger.entries}
              locale={activeLocale}
              dict={copy.ledger}
            />
          </>
        ) : (
          /*
           * A composed empty state, not a blank panel: a customer who has never
           * bought a Discovery Set has no idea credit exists, and this is the
           * one place the house can tell them.
           */
          <EmptyState
            icon={Ticket}
            heading={copy.credit.emptyHeading}
            body={copy.credit.emptyBody}
            cta={copy.credit.emptyCta}
            href="/collections/discovery"
          />
        )}
      </section>

      {/* ── Vouchers ────────────────────────────────── */}
      <section>
        <h2 className="mb-6 font-heading text-base text-ground">
          {copy.list.heading}
        </h2>

        {vouchers.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {vouchers.map((voucher) => (
              <VoucherCard
                key={voucher.id}
                voucher={voucher}
                locale={activeLocale}
                dict={copy.list}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Ticket}
            heading={copy.list.emptyHeading}
            body={copy.list.emptyBody}
            cta={copy.list.emptyCta}
            href="/collections"
          />
        )}
      </section>
    </div>
  );
}
