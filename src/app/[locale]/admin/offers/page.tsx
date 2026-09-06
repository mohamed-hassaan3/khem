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
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listOffers } from "@/src/services/admin/offers";

/**
 * Offers & Bundles.
 *
 * An offer is a rule about the **shape of a basket** — buy this many of these,
 * receive that many of those — and the house applies it automatically. Nothing
 * is typed at checkout, which is what separates it from a discount code, and it
 * reprices no bottle on its own, which separates it from a promotion.
 *
 * The column worth reading twice is **Used**: live redemptions, which is what
 * both caps count. A refunded order returns its use, so this falls as well as
 * rises — it is what the offer is currently costing, not how often it has ever
 * fired.
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

function state(offer: {
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}): { label: string; tone: "live" | "muted" | "warning" } {
  if (!offer.isActive) return { label: "Off", tone: "muted" };
  if (offer.startsAt && new Date(offer.startsAt) > new Date()) {
    return { label: "Scheduled", tone: "warning" };
  }
  if (offer.endsAt && new Date(offer.endsAt) <= new Date()) {
    return { label: "Ended", tone: "muted" };
  }
  return { label: "Running", tone: "live" };
}

const AUDIENCE_LABELS: Record<string, string> = {
  EVERYONE: "Everyone",
  NEW_CUSTOMERS: "New customers",
  EXISTING_CUSTOMERS: "Existing customers",
  SUBSCRIBERS: "Subscribers",
  INVITED: "Invitation only",
};

export default async function AdminOffersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const offers = await listOffers();
  const basePath = localizePath(activeLocale, "/admin/offers");

  return (
    <>
      <AdminPageHeader
        title="Offers"
        description="Buy X, get Y — applied automatically to a qualifying basket. The lowest-priced eligible item is the one given away unless you say otherwise."
        action={
          <AdminLinkButton href={`${basePath}/new`}>
            <Plus size={13} strokeWidth={1.25} />
            New offer
          </AdminLinkButton>
        }
      />

      {offers.length === 0 ? (
        <AdminEmpty
          message="No offers yet. Baskets are priced by the catalog and any running promotion."
          action={
            <AdminLinkButton href={`${basePath}/new`}>
              Create the first offer
            </AdminLinkButton>
          }
        />
      ) : (
        <AdminTable
          headers={[
            "Offer",
            "Rule",
            "Gives away",
            "Audience",
            "Used",
            "Window",
            "State",
            { label: "Edit", hidden: true },
          ]}
        >
          {offers.map((offer) => {
            const shown = state(offer);

            return (
              <AdminRow key={offer.id}>
                <AdminCell>
                  <span className="block font-heading text-[11px] tracking-[0.1em]">
                    {offer.name}
                  </span>
                  {offer.label ? (
                    <span className="mt-2 inline-block border border-gold/40 px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-accent">
                      {offer.label}
                    </span>
                  ) : (
                    <span
                      title="No customer-facing line, so the bag simply reads “Offer”"
                      className="mt-2 inline-block text-[10px] tracking-wide text-ground-subtle"
                    >
                      Unlabelled
                    </span>
                  )}
                </AdminCell>

                <AdminCell>
                  {`Buy ${offer.triggerQuantity} → get ${offer.rewardQuantity}`}
                  {offer.rewardKind === "PERCENTAGE"
                    ? ` at ${offer.rewardValue ?? 0}% off`
                    : " free"}
                </AdminCell>

                <AdminCell muted>
                  {offer.rewardSelection === "LOWEST_PRICED"
                    ? "Cheapest first"
                    : "Dearest first"}
                </AdminCell>

                <AdminCell muted>
                  {AUDIENCE_LABELS[offer.audience] ?? offer.audience}
                  {offer.requiresCode ? ` · ${offer.requiresCode}` : ""}
                </AdminCell>

                <AdminCell>
                  {offer.redemptionCount}
                  {offer.totalUseLimit === null
                    ? ""
                    : ` / ${offer.totalUseLimit}`}
                </AdminCell>

                <AdminCell muted>
                  {offer.startsAt || offer.endsAt
                    ? `${stamp(offer.startsAt)} → ${stamp(offer.endsAt)}`
                    : "Always"}
                </AdminCell>

                <AdminCell>
                  <span
                    className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] ${
                      shown.tone === "live"
                        ? "border-success/40 text-success"
                        : shown.tone === "warning"
                          ? "border-warning/40 text-warning"
                          : "border-ground-border text-ground-muted"
                    }`}
                    title={offer.endsAt ? `Ends ${stamp(offer.endsAt)}` : undefined}
                  >
                    {shown.label}
                  </span>
                </AdminCell>

                <AdminCell>
                  <Link
                    href={`${basePath}/${offer.id}`}
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
