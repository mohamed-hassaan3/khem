import { Ticket } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AccountBell from "@/src/components/account/AccountBell";
import AccountPageHeader from "@/src/components/account/AccountPageHeader";
import CreditPanel from "@/src/components/account/CreditPanel";
import VoucherTicket from "@/src/components/account/VoucherTicket";
import WalletActivity from "@/src/components/account/WalletActivity";
import Price from "@/src/components/ecommerce/Price";
import EmptyState from "@/src/components/ecommerce/EmptyState";
import { getViewer } from "@/src/lib/auth";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import { creditLedgerForUser } from "@/src/services/credits";
import { rewardsForUser } from "@/src/services/rewards";
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

  const [dict, ledger, rewards, vouchers] = await Promise.all([
    getDictionary(activeLocale),
    creditLedgerForUser(viewer.id),
    /*
     * KHEM Points. Returns a disabled shape rather than throwing when the house
     * is not running Rewards, so the section below simply does not render — the
     * same "absent, not empty" treatment the credit panel gives a customer who
     * has never earned one.
     */
    rewardsForUser(viewer.id),
    // The email is the session's verified primary address — a grant may have
    // been issued before this person ever had an account.
    vouchersForUser({ clerkUserId: viewer.id, email: viewer.primaryEmail }),
  ]);

  const hub = dict.account.hub;
  const copy = dict.account.vouchers;

  // One clock for the whole render, so every credit's countdown agrees.
  // eslint-disable-next-line react-hooks/purity -- a dynamic Server Component; this runs once per request
  const now = Date.now();

  /*
   * Available first, then the ones a customer may still be looking for (not
   * yet open, used, expired) — each keeps its ticket so a code they were given
   * is never simply missing.
   */
  const ORDER = ["AVAILABLE", "SCHEDULED", "UNAVAILABLE", "USED", "EXPIRED"] as const;
  const sortedVouchers = [...vouchers].sort(
    (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status),
  );
  const availableVouchers = vouchers.filter((voucher) => voucher.status === "AVAILABLE").length;

  const rise = (step: number) => ({ animationDelay: `${80 + step * 70}ms` });

  const tiles = [
    { key: "vouchers", label: hub.vouchers, value: <span>{availableVouchers}</span> },
    { key: "credit", label: hub.credit, value: <Price cents={ledger.availableInCents} /> },
    ...(rewards.enabled
      ? [{ key: "points", label: hub.points, value: <span>{rewards.balancePoints.toLocaleString("en-US")}</span> }]
      : []),
  ];

  return (
    <div>
      <AccountPageHeader
        eyebrow={hub.wallet.eyebrow}
        heading={hub.wallet.heading}
        aside={hub.wallet.intro}
        action={<AccountBell viewer={viewer} locale={activeLocale} dict={dict} />}
      />

      {/* ── Balances, one band ─────────────────────────── */}
      <div
        className="acct-rise mb-8 grid gap-2 lg:mb-10 lg:gap-4"
        style={{ ...rise(0), gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
      >
        {tiles.map((tile) => (
          <div key={tile.key} className="min-w-0 rounded-lg border border-ground-border bg-stone p-3 lg:p-5">
            <p {...ltrIsland(activeLocale)} className="truncate font-heading text-[17px] text-ground-accent rtl:text-right lg:text-[24px]">
              {tile.value}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-ground-muted rtl:text-[12px] rtl:normal-case rtl:tracking-normal">
              {tile.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-10">
        {/* ── Vouchers ───────────────────────────────────── */}
        <section className="acct-rise" style={rise(1)}>
          <SectionHead
            title={hub.wallet.vouchers}
            aside={
              availableVouchers > 0
                ? availableVouchers === 1
                  ? hub.wallet.readyOne
                  : interpolate(hub.wallet.ready, { count: String(availableVouchers) })
                : null
            }
          />
          {sortedVouchers.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {sortedVouchers.map((voucher) => (
                <VoucherTicket key={voucher.id} voucher={voucher} locale={activeLocale} dict={dict.account} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-ground-border px-5 py-6 text-[12px] leading-relaxed text-ground-muted">
              {hub.wallet.noVouchers}
            </p>
          )}
        </section>

        <div className="flex flex-col gap-8 lg:gap-10">
          {/* ── Discovery credit ─────────────────────────── */}
          <section className="acct-rise" style={rise(2)}>
            <SectionHead title={hub.wallet.credit} />
            {ledger.credits.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {ledger.credits.map((credit) => (
                  <CreditPanel key={credit.id} credit={credit} now={now} locale={activeLocale} dict={dict.account} />
                ))}
              </div>
            ) : (
              /*
               * A composed empty state, not a blank panel: a customer who has
               * never bought a Discovery Set has no idea credit exists, and
               * this is the one place the house can tell them.
               */
              <EmptyState
                icon={Ticket}
                heading={copy.credit.emptyHeading}
                body={copy.credit.emptyBody}
                cta={copy.credit.emptyCta}
                href="/collections/discovery"
                compact
              />
            )}
          </section>

          {/* ── Points (only while the programme runs) ───── */}
          {rewards.enabled ? (
            <section className="acct-rise" style={rise(3)}>
              <SectionHead title={hub.wallet.points} />
              <div className="acct-card rounded-lg border border-ground-border bg-stone p-4 sm:p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p {...ltrIsland(activeLocale)} className="font-heading text-[22px] text-ground-accent">
                    {rewards.balancePoints.toLocaleString("en-US")}
                  </p>
                  {rewards.valueInCents > 0 ? (
                    <p className="text-[12px] text-ground-muted">
                      {hub.wallet.worth} <Price cents={rewards.valueInCents} className="text-ground" />
                    </p>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ground-muted">
                  {rewards.balancePoints === 0 && rewards.entries.length === 0
                    ? copy.rewards.empty
                    : rewards.pointsToNextReward > 0
                      ? interpolate(copy.rewards.toNext, { points: String(rewards.pointsToNextReward) })
                      : copy.rewards.readyToSpend}
                </p>
              </div>
            </section>
          ) : null}
        </div>

        {/* ── Activity: credit and points, one list ───────── */}
        <section className="acct-rise lg:col-span-2" style={rise(4)}>
          <SectionHead title={hub.wallet.activity} />
          <WalletActivity
            credit={ledger.entries}
            points={rewards.enabled ? rewards.entries : []}
            locale={activeLocale}
            dict={dict.account}
          />
        </section>
      </div>
    </div>
  );
}

function SectionHead({ title, aside }: { title: string; aside?: string | null }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="font-heading text-[15px] font-medium tracking-[0.06em] text-ground rtl:text-[19px] rtl:tracking-normal">
        {title}
      </h2>
      {aside ? <span className="text-[11px] text-ground-muted rtl:text-[12px]">{aside}</span> : null}
    </div>
  );
}
