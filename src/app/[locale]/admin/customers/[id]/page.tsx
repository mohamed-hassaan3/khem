import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  AdminCell,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import { egp } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import PointsAdjuster from "@/src/components/admin/PointsAdjuster";
import { getAdminBenefitSettings } from "@/src/services/admin/benefits";
import { creditsForClerkUser } from "@/src/services/admin/credits";
import { getAdminCustomer } from "@/src/services/admin/customers";
import {
  pointsLedgerForClerkUser,
  rewardBalanceForClerkUser,
} from "@/src/services/admin/rewards";
import type { CustomerAddress } from "@/src/types/customer";

/**
 * One customer.
 *
 * Read-only, and that is the design rather than an omission. Everything on this
 * screen is owned somewhere else and would go stale or wrong if it could also
 * be edited here:
 *
 *  - the **name, email and phone** belong to Clerk, which is the identity
 *    authority; a value typed here would be overwritten by the next
 *    `user.updated` webhook and would have lied in the meantime;
 *  - the **addresses** belong to the customer, who edits them in `/account`;
 *  - the **orders** are moved from the order book, where the transition table
 *    and the customer emails live.
 *
 * What the desk gets is the thing it could not get anywhere else: one person,
 * everything they have bought, and what they are worth to the house.
 *
 * ## No wishlist panel
 *
 * `supabase/AGENTS.md` §6 lists one. The root `AGENTS.md` §9 records that the
 * wishlist was withdrawn from the product entirely — route, provider, storage
 * key and all — and must not be rebuilt from that section. It is absent
 * deliberately.
 */

export const dynamic = "force-dynamic";

function label(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

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

/** The address as a courier reads it: one line per line, empties dropped. */
function addressLines(address: CustomerAddress): string[] {
  return [
    address.recipient,
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(", "),
    [address.postalCode, address.country].filter(Boolean).join(" "),
  ]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line && line.length > 0));
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

export default async function AdminCustomerPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const customer = await getAdminCustomer(decodeURIComponent(id));
  if (!customer) notFound();

  /*
   * The two ledgers, read only for somebody with an account.
   *
   * Both are keyed by Clerk id — a walk-in has no account, so no points and no
   * credit could ever have been issued to them, and asking would be two round
   * trips for two guaranteed empty answers.
   */
  const clerkId = customer.clerkId;

  const [benefits, rewardBalance, pointsLedger, credits] = clerkId
    ? await Promise.all([
        getAdminBenefitSettings(),
        rewardBalanceForClerkUser(clerkId),
        pointsLedgerForClerkUser(clerkId, 25),
        creditsForClerkUser(clerkId),
      ])
    : [null, null, [], []];

  const listPath = localizePath(activeLocale, "/admin/customers");
  const ordersPath = localizePath(activeLocale, "/admin/orders");
  const creditsPath = localizePath(activeLocale, "/admin/credits");

  return (
    <>
      <Link
        href={listPath}
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
      >
        <ArrowLeft size={13} strokeWidth={1.25} />
        All customers
      </Link>

      <AdminPageHeader
        title={customer.name ?? "Unnamed customer"}
        description={
          customer.hasAccount
            ? `Registered account · joined ${stamp(customer.joinedAt)}`
            : `Walk-in · first order ${stamp(customer.joinedAt)}`
        }
      />

      <div className="grid gap-5 md:gap-8 xl:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          {/* ── Orders ─────────────────────────────────── */}
          <section>
            <h2 className="mb-5 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
              Orders
            </h2>

            {customer.orders.length === 0 ? (
              <div className="border border-ground-border px-5 py-12 text-center sm:px-8">
                <p className="text-[12px] leading-relaxed text-ground-muted">
                  This customer has an account but has not ordered yet.
                </p>
              </div>
            ) : (
              <AdminTable
                headers={[
                  "Order",
                  "Placed",
                  "Total",
                  "Payment",
                  "Status",
                  { label: "Open", hidden: true },
                ]}
              >
                {customer.orders.map((order) => (
                  <AdminRow key={order.id}>
                    <AdminCell>
                      <span className="block font-heading text-[11px] tracking-[0.1em]">
                        {order.orderNumber}
                      </span>
                      <span className="mt-1 block text-[10px] tracking-wide text-ground-subtle">
                        {order.channel.toLowerCase()}
                      </span>
                      {order.firstOpenedAt === null ? (
                        <span
                          title="Nobody at the desk has opened this order yet"
                          className="mt-2 inline-block border border-gold/40 px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-accent"
                        >
                          New
                        </span>
                      ) : null}
                    </AdminCell>

                    <AdminCell muted>{stamp(order.placedAt)}</AdminCell>
                    <AdminCell>{egp(order.totalInCents)}</AdminCell>

                    <AdminCell>
                      <span
                        className={
                          order.paymentStatus === "PAID"
                            ? "text-success"
                            : order.paymentStatus === "FAILED"
                              ? "text-danger"
                              : "text-ground-muted"
                        }
                      >
                        {label(order.paymentStatus)}
                      </span>
                    </AdminCell>

                    <AdminCell>
                      <span
                        className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] ${
                          order.status === "CANCELLED" || order.status === "REFUNDED"
                            ? "border-ground-border text-ground-muted"
                            : order.status === "DELIVERED"
                              ? "border-success/40 text-success"
                              : "border-gold/40 text-ground-accent"
                        }`}
                      >
                        {label(order.status)}
                      </span>
                    </AdminCell>

                    <AdminCell>
                      <Link
                        href={`${ordersPath}/${order.orderNumber}`}
                        className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                      >
                        Open
                      </Link>
                    </AdminCell>
                  </AdminRow>
                ))}
              </AdminTable>
            )}
          </section>

          {/* ── Discovery credits ──────────────────────── */}
          {customer.hasAccount ? (
            <section>
              <h2 className="mb-5 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
                Discovery credits
              </h2>

              {customer.credits.length === 0 ? (
                <div className="border border-ground-border px-5 py-10 text-center sm:px-8">
                  <p className="text-[12px] leading-relaxed text-ground-muted">
                    No credits. One is earned the moment a Discovery Set on this
                    account is paid for.
                  </p>
                </div>
              ) : (
                <AdminTable
                  headers={[
                    "Worth",
                    "Balance",
                    "Status",
                    "Expires",
                    { label: "Open", hidden: true },
                  ]}
                >
                  {customer.credits.map((credit) => (
                    <AdminRow key={credit.id}>
                      <AdminCell>{egp(credit.amountInCents)}</AdminCell>
                      <AdminCell muted>{egp(credit.balanceInCents)}</AdminCell>
                      <AdminCell>
                        <span
                          className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] ${
                            credit.status === "AVAILABLE"
                              ? "border-success/40 text-success"
                              : credit.status === "PENDING_DELIVERY"
                                ? "border-warning/40 text-warning"
                                : "border-ground-border text-ground-muted"
                          }`}
                        >
                          {credit.status.replace("_", " ").toLowerCase()}
                        </span>
                      </AdminCell>
                      <AdminCell muted>{stamp(credit.expiresAt)}</AdminCell>
                      <AdminCell>
                        <Link
                          href={`${creditsPath}/${credit.id}`}
                          className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                        >
                          Open
                        </Link>
                      </AdminCell>
                    </AdminRow>
                  ))}
                </AdminTable>
              )}
            </section>
          ) : null}

          {/* ── Address book ───────────────────────────── */}
          {customer.hasAccount ? (
            <section>
              <h2 className="mb-5 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
                Saved addresses
              </h2>

              {customer.addresses.length === 0 ? (
                <div className="border border-ground-border px-5 py-10 text-center sm:px-8">
                  <p className="text-[12px] leading-relaxed text-ground-muted">
                    No saved addresses. The customer adds these themselves in
                    their account.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {customer.addresses.map((address) => (
                    <div key={address.id} className="border border-ground-border p-5">
                      <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent">
                        {address.label}
                        {address.isDefault ? (
                          <span className="ms-2 text-ground-subtle">· default</span>
                        ) : null}
                      </p>
                      <address className="mt-3 space-y-1 text-[12px] not-italic leading-relaxed tracking-wide text-ground-muted">
                        {addressLines(address).map((line) => (
                          <span key={line} className="block">
                            {line}
                          </span>
                        ))}
                      </address>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>

        {/* ── The record ───────────────────────────────── */}
        <aside className="space-y-8">
          {/*
            ── Rewards ────────────────────────────────────
            
            What support is actually asked about: "how many points do I have,
            and where did they go". Present only for an account, and only while
            the programme is running — a panel of zeroes for a house that does
            not do points would be a screen full of a feature it has not bought.
          */}
          {clerkId && benefits?.rewardsEnabled && rewardBalance ? (
            <div className="border border-ground-border p-5 sm:p-6">
              <h2 className="mb-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
                Rewards
              </h2>
              <dl>
                <Detail term="Current balance">
                  <span className="font-heading text-lg tracking-[0.1em] text-ground-accent">
                    {rewardBalance.balancePoints.toLocaleString("en-US")}
                  </span>
                </Detail>
                <Detail term="Earned to date">
                  {rewardBalance.lifetimeEarned.toLocaleString("en-US")}
                </Detail>
                <Detail term="Redeemed">
                  {rewardBalance.lifetimeRedeemed.toLocaleString("en-US")}
                </Detail>
                <Detail term="Expired">
                  {rewardBalance.expiredPoints.toLocaleString("en-US")}
                </Detail>
              </dl>

              <div className="mt-4">
                <PointsAdjuster
                  clerkUserId={clerkId}
                  name={customer.name ?? customer.email ?? "this customer"}
                />
              </div>

              {pointsLedger.length > 0 ? (
                <ul className="mt-5 space-y-2 border-t border-ground-border pt-4">
                  {pointsLedger.slice(0, 8).map((movement) => (
                    <li
                      key={movement.id}
                      className="flex items-baseline justify-between gap-3 text-[11px]"
                    >
                      <span className="text-ground-muted">
                        {label(movement.source.replace(/_/g, " "))}
                        <span className="ms-2 text-ground-subtle">
                          {stamp(movement.occurredAt)}
                        </span>
                      </span>
                      <span
                        className={`font-heading tabular-nums ${
                          movement.amount >= 0 ? "text-ground-accent" : "text-ground-muted"
                        }`}
                      >
                        {movement.amount >= 0 ? "+" : "−"}
                        {Math.abs(movement.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[11px] leading-relaxed text-ground-subtle">
                  Nothing has moved on this balance yet.
                </p>
              )}
            </div>
          ) : null}

          {/*
            ── Discovery Credit ───────────────────────────
            
            The other instrument, kept apart because it is not the same thing: a
            credit is spent whole against one full-size fragrance and forfeits
            the remainder. Shown whenever the customer holds one, regardless of
            the switch — the credits are real either way, and support has to be
            able to see them after the house stops issuing new ones.
          */}
          {credits.length > 0 ? (
            <div className="border border-ground-border p-5 sm:p-6">
              <h2 className="mb-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
                Discovery Credit
              </h2>
              <dl>
                <Detail term="Available">
                  <span className="font-heading text-lg tracking-[0.1em] text-ground-accent">
                    {egp(
                      credits
                        .filter((credit) => credit.status === "AVAILABLE")
                        .reduce((sum, credit) => sum + credit.balanceInCents, 0),
                    )}
                  </span>
                </Detail>
                <Detail term="Earned">
                  {egp(
                    credits.reduce((sum, credit) => sum + credit.amountInCents, 0),
                  )}
                </Detail>
                <Detail term="Credits held">{credits.length}</Detail>
                <Detail term="Awaiting delivery">
                  {
                    credits.filter(
                      (credit) => credit.status === "PENDING_DELIVERY",
                    ).length
                  }
                </Detail>
              </dl>
              <p className="mt-4 text-[11px] leading-relaxed text-ground-subtle">
                A credit awaiting delivery cannot be spent — the sixty days start
                when the Discovery Set arrives. The full ledger is under Credits.
              </p>
            </div>
          ) : null}

          <div className="border border-ground-border p-5 sm:p-6">
            <h2 className="mb-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
              Standing
            </h2>
            <dl>
              <Detail term="Lifetime spend">
                <span className="font-heading text-lg tracking-[0.1em] text-ground-accent">
                  {egp(customer.lifetimeSpendInCents)}
                </span>
              </Detail>
              <Detail term="Orders placed">{customer.orderCount}</Detail>
              <Detail term="Last order">{stamp(customer.lastOrderAt)}</Detail>
            </dl>
            <p className="mt-4 text-[11px] leading-relaxed text-ground-subtle">
              Spend excludes cancelled and refunded orders. Those still count as
              orders placed, because they were.
            </p>
          </div>

          <div className="border border-ground-border p-5 sm:p-6">
            <h2 className="mb-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
              Contact
            </h2>
            <dl>
              <Detail term="Email">{customer.email ?? "Not given"}</Detail>
              <Detail term="Phone">{customer.phone ?? "Not given"}</Detail>
              <Detail term="Account">
                {customer.hasAccount ? "Registered with Clerk" : "No account"}
              </Detail>
            </dl>
            <p className="mt-4 text-[11px] leading-relaxed text-ground-subtle">
              Identity is held by Clerk and mirrored here. Edits belong in Clerk
              or in the customer&rsquo;s own account, not on this screen.
            </p>
          </div>

          <div className="border border-ground-border p-5 sm:p-6">
            <h2 className="mb-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
              Marketing
            </h2>
            <dl>
              <Detail term="Consent">
                <span
                  className={
                    customer.marketingOptIn ? "text-success" : "text-ground-muted"
                  }
                >
                  {customer.marketingOptIn ? "Opted in" : "Not opted in"}
                </span>
              </Detail>
              <Detail term="Last changed">
                {stamp(customer.marketingOptInAt, true)}
              </Detail>
            </dl>
            <p className="mt-4 text-[11px] leading-relaxed text-ground-subtle">
              The date moves only when the answer changes, in either direction —
              a withdrawal needs a date as much as an agreement does.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
