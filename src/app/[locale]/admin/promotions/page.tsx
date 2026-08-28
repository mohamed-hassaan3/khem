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
import { listPromotions } from "@/src/services/admin/promotions";

/**
 * Promotional pricing.
 *
 * The column worth reading twice is **Pricing** — how many products this
 * campaign is the winning price for right now. It is counted from
 * `active_product_promotions`, the same view the storefront and `place_order()`
 * read, so it is the number of bottles actually repriced rather than the number
 * somebody selected. A collection-wide campaign that a product-level one
 * outranks will show fewer, and that is the truth about what it is doing.
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

function state(promotion: {
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}): { label: string; tone: "live" | "muted" | "warning" } {
  if (!promotion.isActive) return { label: "Off", tone: "muted" };
  if (promotion.startsAt && new Date(promotion.startsAt) > new Date()) {
    return { label: "Scheduled", tone: "warning" };
  }
  if (promotion.endsAt && new Date(promotion.endsAt) <= new Date()) {
    return { label: "Ended", tone: "muted" };
  }
  return { label: "Running", tone: "live" };
}

export default async function AdminPromotionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const promotions = await listPromotions();
  const basePath = localizePath(activeLocale, "/admin/promotions");

  return (
    <>
      <AdminPageHeader
        title="Promotions"
        description="Seasonal pricing — Black Friday, Ramadan, a mid-season cut. Nothing to type at checkout: the price on the card is the price. Codes and the welcome offer live under Discounts."
        action={
          <AdminLinkButton href={`${basePath}/new`}>
            <Plus size={13} strokeWidth={1.25} />
            New campaign
          </AdminLinkButton>
        }
      />

      {promotions.length === 0 ? (
        <AdminEmpty
          message="No promotional campaigns yet. Every product sells at its list price."
          action={
            <AdminLinkButton href={`${basePath}/new`}>
              Create the first campaign
            </AdminLinkButton>
          }
        />
      ) : (
        <AdminTable
          headers={[
            "Campaign",
            "Takes off",
            "Applies to",
            "Pricing",
            "Window",
            "Codes",
            "State",
            { label: "Edit", hidden: true },
          ]}
        >
          {promotions.map((promotion) => {
            const shown = state(promotion);

            return (
              <AdminRow key={promotion.id}>
                <AdminCell>
                  <span className="block font-heading text-[11px] tracking-[0.1em]">
                    {promotion.name}
                  </span>
                  {promotion.label ? (
                    <span className="mt-2 inline-block border border-gold/40 px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.2em] text-gold">
                      {promotion.label}
                    </span>
                  ) : (
                    <span
                      title="No campaign label, so cards carry no banner — a quiet reduction"
                      className="mt-2 inline-block text-[10px] tracking-wide text-ivory/25"
                    >
                      Unlabelled
                    </span>
                  )}
                </AdminCell>

                <AdminCell>
                  {promotion.kind === "PERCENTAGE"
                    ? `${promotion.value}%`
                    : egp(promotion.value)}
                </AdminCell>

                <AdminCell muted>
                  {promotion.appliesTo === "PRODUCTS"
                    ? "Selected products"
                    : "Selected collections"}
                </AdminCell>

                <AdminCell>
                  {promotion.productCount === 0
                    ? "—"
                    : `${promotion.productCount} product${promotion.productCount === 1 ? "" : "s"}`}
                </AdminCell>

                <AdminCell muted>
                  {promotion.startsAt || promotion.endsAt
                    ? `${stamp(promotion.startsAt)} → ${stamp(promotion.endsAt)}`
                    : "Always"}
                </AdminCell>

                <AdminCell muted>
                  {promotion.stacksWithCodes ? "Stack" : "Blocked"}
                </AdminCell>

                <AdminCell>
                  <span
                    className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] ${
                      shown.tone === "live"
                        ? "border-success/40 text-success"
                        : shown.tone === "warning"
                          ? "border-warning/40 text-warning"
                          : "border-border text-ivory/30"
                    }`}
                    title={
                      promotion.endsAt ? `Ends ${stamp(promotion.endsAt)}` : undefined
                    }
                  >
                    {shown.label}
                  </span>
                </AdminCell>

                <AdminCell>
                  <Link
                    href={`${basePath}/${promotion.id}`}
                    className="font-heading text-[10px] uppercase tracking-[0.2em] text-gold/70 transition-colors duration-300 hover:text-gold"
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
