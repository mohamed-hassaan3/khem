import Link from "next/link";
import { Plus } from "lucide-react";

import {
  AdminCell,
  AdminEmpty,
  AdminLinkButton,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import { egp } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listDiscounts } from "@/src/services/admin/discounts";

/**
 * Discount codes.
 *
 * Every figure here is **counted from the redemption ledger**, never stored:
 * uses, remaining uses, what the house gave away, and what the orders that used
 * a code were worth. A refunded order releases its use, so it stops counting
 * against both caps and stops counting as revenue.
 *
 * The one number worth reading twice is *given away* beside *revenue*: together
 * they say what a campaign cost and what it brought in.
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

/** Live, scheduled, ended or off — the state a code is actually in today. */
function state(discount: {
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  remainingUses: number | null;
}): { label: string; tone: "live" | "muted" | "warning" } {
  if (!discount.isActive) return { label: "Off", tone: "muted" };
  if (discount.remainingUses === 0) return { label: "Used up", tone: "muted" };
  if (discount.startsAt && new Date(discount.startsAt) > new Date()) {
    return { label: "Scheduled", tone: "warning" };
  }
  if (discount.endsAt && new Date(discount.endsAt) <= new Date()) {
    return { label: "Ended", tone: "muted" };
  }
  return { label: "Live", tone: "live" };
}

export default async function AdminDiscountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const discounts = await listDiscounts();
  const basePath = localizePath(activeLocale, "/admin/discounts");

  return (
    <>
      <AdminPageHeader
        title="Discounts"
        description="Codes the house honours at checkout. What a code is worth is decided by the database when an order is placed — never by the browser."
        action={
          <AdminLinkButton href={`${basePath}/new`}>
            <Plus size={13} strokeWidth={1.25} />
            New code
          </AdminLinkButton>
        }
      />

      {discounts.length === 0 ? (
        <AdminEmpty
          message="No discount codes yet."
          action={
            <AdminLinkButton href={`${basePath}/new`}>
              Create the first code
            </AdminLinkButton>
          }
        />
      ) : (
        <AdminTable
          headers={[
            "Code",
            "Worth",
            "Applies to",
            "Used",
            "Given away",
            "Revenue",
            "State",
            { label: "Edit", hidden: true },
          ]}
        >
          {discounts.map((discount) => {
            const shown = state(discount);

            return (
              <AdminRow key={discount.id}>
                <AdminCell>
                  <span className="block font-heading text-[11px] tracking-[0.15em]">
                    {discount.code}
                  </span>
                  {discount.requiresGrant ? (
                    <span
                      title="Only customers issued a grant may redeem this code"
                      className="mt-2 inline-block border border-gold/40 px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-accent"
                    >
                      By invitation
                    </span>
                  ) : null}
                </AdminCell>

                <AdminCell>
                  {discount.kind === "PERCENTAGE"
                    ? `${discount.value}%`
                    : egp(discount.value)}
                </AdminCell>

                <AdminCell muted>
                  {discount.appliesTo === "ALL"
                    ? "Everything"
                    : discount.appliesTo === "PRODUCTS"
                      ? "Selected products"
                      : "Selected collections"}
                </AdminCell>

                <AdminCell muted>
                  {discount.timesUsed}
                  {discount.totalUseLimit !== null
                    ? ` of ${discount.totalUseLimit}`
                    : ""}
                </AdminCell>

                <AdminCell muted>{egp(discount.discountedInCents)}</AdminCell>
                <AdminCell>{egp(discount.revenueInCents)}</AdminCell>

                <AdminCell>
                  <span
                    className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] ${
                      shown.tone === "live"
                        ? "border-success/40 text-success"
                        : shown.tone === "warning"
                          ? "border-warning/40 text-warning"
                          : "border-ground-border text-ground-muted"
                    }`}
                    title={
                      discount.endsAt ? `Ends ${stamp(discount.endsAt)}` : undefined
                    }
                  >
                    {shown.label}
                  </span>
                </AdminCell>

                <AdminCell>
                  <Link
                    href={`${basePath}/${discount.code}`}
                    className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                  >
                    Edit
                  </Link>
                </AdminCell>
              </AdminRow>
            );
          })}
        </AdminTable>
      )}
    </>
  );
}
