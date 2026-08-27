import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  AdminCell,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import DiscountForm from "@/src/components/admin/DiscountForm";
import { egp } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  listAdminCollections,
  listAdminProducts,
} from "@/src/services/admin/catalog";
import { getDiscount } from "@/src/services/admin/discounts";

/**
 * One discount code.
 *
 * The usage table beneath the form is the ledger §12 asks for — every order the
 * code was used on, what it took off, and whether that use was released by a
 * refund. A released row is kept rather than deleted: it stopped counting
 * against the caps, and that it happened is worth knowing.
 */
export const dynamic = "force-dynamic";

function stamp(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export default async function EditDiscountPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [discount, products, collections] = await Promise.all([
    getDiscount(decodeURIComponent(code)),
    listAdminProducts(),
    listAdminCollections(),
  ]);

  if (!discount) notFound();

  const ordersPath = localizePath(activeLocale, "/admin/orders");

  return (
    <>
      <Link
        href={localizePath(activeLocale, "/admin/discounts")}
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35 transition-colors duration-300 hover:text-gold"
      >
        <ArrowLeft size={13} strokeWidth={1.25} />
        All discounts
      </Link>

      <AdminPageHeader
        title={discount.code}
        description={`Used ${discount.timesUsed} time${discount.timesUsed === 1 ? "" : "s"} · ${egp(discount.discountedInCents)} given away · ${egp(discount.revenueInCents)} of orders`}
      />

      <DiscountForm
        discount={discount}
        locale={activeLocale}
        products={products
          .filter((product) => !product.isArchived)
          .map((product) => ({ slug: product.slug, name: product.name }))}
        collections={collections.map((collection) => ({
          slug: collection.slug,
          name: collection.name,
        }))}
      />

      {discount.requiresGrant ? (
        <section className="mt-12 max-w-3xl">
          <h2 className="mb-5 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
            Grants
          </h2>

          {discount.grants.length === 0 ? (
            <p className="border border-border px-5 py-10 text-center text-[12px] leading-relaxed text-ivory/35">
              No grants issued. Nobody can redeem this code until one is.
            </p>
          ) : (
            <AdminTable headers={["Email", "Issued", "Expires", "Used"]}>
              {discount.grants.map((grant) => (
                <AdminRow key={grant.id}>
                  <AdminCell>{grant.email}</AdminCell>
                  <AdminCell muted>{stamp(grant.issuedAt)}</AdminCell>
                  <AdminCell muted>{stamp(grant.expiresAt)}</AdminCell>
                  <AdminCell muted>{stamp(grant.usedAt)}</AdminCell>
                </AdminRow>
              ))}
            </AdminTable>
          )}
        </section>
      ) : null}

      <section className="mt-12 max-w-3xl">
        <h2 className="mb-5 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
          Every use
        </h2>

        {discount.redemptions.length === 0 ? (
          <p className="border border-border px-5 py-10 text-center text-[12px] leading-relaxed text-ivory/35">
            This code has not been used yet.
          </p>
        ) : (
          <AdminTable headers={["Order", "Customer", "Took off", "When", "State"]}>
            {discount.redemptions.map((use) => (
              <AdminRow key={use.id}>
                <AdminCell>
                  {use.orderNumber ? (
                    <Link
                      href={`${ordersPath}/${use.orderNumber}`}
                      className="font-heading text-[11px] tracking-[0.1em] transition-colors duration-300 hover:text-gold"
                    >
                      {use.orderNumber}
                    </Link>
                  ) : (
                    "—"
                  )}
                </AdminCell>
                <AdminCell muted>{use.email ?? "—"}</AdminCell>
                <AdminCell>{egp(use.amountInCents)}</AdminCell>
                <AdminCell muted>{stamp(use.redeemedAt)}</AdminCell>
                <AdminCell>
                  <span
                    className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] ${
                      use.releasedAt === null
                        ? "border-gold/40 text-gold"
                        : "border-border text-ivory/30"
                    }`}
                    title={
                      use.releasedAt
                        ? "The order was refunded; this use was returned to both caps"
                        : undefined
                    }
                  >
                    {use.releasedAt === null ? "Counted" : "Released"}
                  </span>
                </AdminCell>
              </AdminRow>
            ))}
          </AdminTable>
        )}
      </section>
    </>
  );
}
