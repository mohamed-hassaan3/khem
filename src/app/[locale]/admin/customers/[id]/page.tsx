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
import { getAdminCustomer } from "@/src/services/admin/customers";
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
    <div className="border-b border-border py-3 last:border-b-0">
      <dt className="font-heading text-[9px] uppercase tracking-[0.2em] text-ivory/25">
        {term}
      </dt>
      <dd className="mt-1.5 text-[12px] tracking-wide text-ivory/70">{children}</dd>
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

  const listPath = localizePath(activeLocale, "/admin/customers");
  const ordersPath = localizePath(activeLocale, "/admin/orders");
  const creditsPath = localizePath(activeLocale, "/admin/credits");

  return (
    <>
      <Link
        href={listPath}
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35 transition-colors duration-300 hover:text-gold"
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
            <h2 className="mb-5 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
              Orders
            </h2>

            {customer.orders.length === 0 ? (
              <div className="border border-border px-5 py-12 text-center sm:px-8">
                <p className="text-[12px] leading-relaxed text-ivory/35">
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
                      <span className="mt-1 block text-[10px] tracking-wide text-ivory/25">
                        {order.channel.toLowerCase()}
                      </span>
                      {order.firstOpenedAt === null ? (
                        <span
                          title="Nobody at the desk has opened this order yet"
                          className="mt-2 inline-block border border-gold/40 px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.2em] text-gold"
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
                              : "text-ivory/35"
                        }
                      >
                        {label(order.paymentStatus)}
                      </span>
                    </AdminCell>

                    <AdminCell>
                      <span
                        className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] ${
                          order.status === "CANCELLED" || order.status === "REFUNDED"
                            ? "border-border text-ivory/30"
                            : order.status === "DELIVERED"
                              ? "border-success/40 text-success"
                              : "border-gold/40 text-gold"
                        }`}
                      >
                        {label(order.status)}
                      </span>
                    </AdminCell>

                    <AdminCell>
                      <Link
                        href={`${ordersPath}/${order.orderNumber}`}
                        className="font-heading text-[10px] uppercase tracking-[0.2em] text-gold/70 transition-colors duration-300 hover:text-gold"
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
              <h2 className="mb-5 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
                Discovery credits
              </h2>

              {customer.credits.length === 0 ? (
                <div className="border border-border px-5 py-10 text-center sm:px-8">
                  <p className="text-[12px] leading-relaxed text-ivory/35">
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
                                : "border-border text-ivory/30"
                          }`}
                        >
                          {credit.status.replace("_", " ").toLowerCase()}
                        </span>
                      </AdminCell>
                      <AdminCell muted>{stamp(credit.expiresAt)}</AdminCell>
                      <AdminCell>
                        <Link
                          href={`${creditsPath}/${credit.id}`}
                          className="font-heading text-[10px] uppercase tracking-[0.2em] text-gold/70 transition-colors duration-300 hover:text-gold"
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
              <h2 className="mb-5 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
                Saved addresses
              </h2>

              {customer.addresses.length === 0 ? (
                <div className="border border-border px-5 py-10 text-center sm:px-8">
                  <p className="text-[12px] leading-relaxed text-ivory/35">
                    No saved addresses. The customer adds these themselves in
                    their account.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {customer.addresses.map((address) => (
                    <div key={address.id} className="border border-border p-5">
                      <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-gold/70">
                        {address.label}
                        {address.isDefault ? (
                          <span className="ms-2 text-ivory/25">· default</span>
                        ) : null}
                      </p>
                      <address className="mt-3 space-y-1 text-[12px] not-italic leading-relaxed tracking-wide text-ivory/60">
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
          <div className="border border-border p-5 sm:p-6">
            <h2 className="mb-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
              Standing
            </h2>
            <dl>
              <Detail term="Lifetime spend">
                <span className="font-heading text-lg tracking-[0.1em] text-gold">
                  {egp(customer.lifetimeSpendInCents)}
                </span>
              </Detail>
              <Detail term="Orders placed">{customer.orderCount}</Detail>
              <Detail term="Last order">{stamp(customer.lastOrderAt)}</Detail>
            </dl>
            <p className="mt-4 text-[11px] leading-relaxed text-ivory/25">
              Spend excludes cancelled and refunded orders. Those still count as
              orders placed, because they were.
            </p>
          </div>

          <div className="border border-border p-5 sm:p-6">
            <h2 className="mb-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
              Contact
            </h2>
            <dl>
              <Detail term="Email">{customer.email ?? "Not given"}</Detail>
              <Detail term="Phone">{customer.phone ?? "Not given"}</Detail>
              <Detail term="Account">
                {customer.hasAccount ? "Registered with Clerk" : "No account"}
              </Detail>
            </dl>
            <p className="mt-4 text-[11px] leading-relaxed text-ivory/25">
              Identity is held by Clerk and mirrored here. Edits belong in Clerk
              or in the customer&rsquo;s own account, not on this screen.
            </p>
          </div>

          <div className="border border-border p-5 sm:p-6">
            <h2 className="mb-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
              Marketing
            </h2>
            <dl>
              <Detail term="Consent">
                <span
                  className={
                    customer.marketingOptIn ? "text-success" : "text-ivory/35"
                  }
                >
                  {customer.marketingOptIn ? "Opted in" : "Not opted in"}
                </span>
              </Detail>
              <Detail term="Last changed">
                {stamp(customer.marketingOptInAt, true)}
              </Detail>
            </dl>
            <p className="mt-4 text-[11px] leading-relaxed text-ivory/25">
              The date moves only when the answer changes, in either direction —
              a withdrawal needs a date as much as an agreement does.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
