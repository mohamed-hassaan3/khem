import { ChevronRight, Eye, Pencil, Plus } from "lucide-react";

import AdminLink from "@/src/components/admin/AdminLink";
import LocalTimestamp from "@/src/components/admin/LocalTimestamp";
import {
  AdminEmpty,
  AdminLinkButton,
  AdminPageHeader,
} from "@/src/components/admin/AdminTable";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listCampaigns, subscriberCount } from "@/src/services/admin/campaigns";
import { isEditable } from "@/src/types/campaign";
import { SHOP_TIME_ZONE } from "@/src/lib/shop-time";

/**
 * Marketing campaigns.
 *
 * The list exists to answer two questions before anything else: what has been
 * sent, and what is still a draft. A campaign that has gone out is history — it
 * cannot be edited, and this screen shows it as a record rather than as
 * something to pick up again.
 *
 * The audience figures at the top are live counts of the two lists, not
 * snapshots: they are what the *next* campaign would reach.
 */
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "Draft", tone: "border-ground-border text-ground-muted" },
  SCHEDULED: { label: "Scheduled", tone: "border-gold/50 text-ground-accent" },
  SENDING: { label: "Sending", tone: "border-info/40 text-info" },
  SENT: { label: "Sent", tone: "border-success/40 text-success" },
  CANCELLED: { label: "Cancelled", tone: "border-danger/40 text-danger" },
};

const TYPE_LABEL: Record<string, string> = {
  NEW_ARRIVAL: "New arrival",
  DISCOUNT: "Discount",
  NEW_COLLECTION: "New collection",
  EXCLUSIVE_OFFER: "Exclusive offer",
  SEASONAL: "Seasonal",
  CUSTOM: "Custom",
};

function stamp(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: SHOP_TIME_ZONE,
  }).format(new Date(iso));
}

export default async function AdminCampaignsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, campaigns, en, ar] = await Promise.all([
    params,
    listCampaigns(),
    subscriberCount("en"),
    subscriberCount("ar"),
  ]);

  const activeLocale = isLocale(locale) ? locale : "en";

  return (
    <>
      <AdminPageHeader
        title="Campaigns"
        description={`Letters to the Inner Circle. ${en} subscribed on the English list, ${ar} on the Arabic. A campaign that has been sent cannot be edited.`}
        action={
          <AdminLinkButton href={localizePath(activeLocale, "/admin/campaigns/new")}>
            <Plus size={13} strokeWidth={1.5} />
            New campaign
          </AdminLinkButton>
        }
      />

      {/*
        * The last column is an action, so its heading is hidden rather than
        * blank — see `AdminHeader` for why an empty string was the wrong way to
        * say "this column has no name".
        */}
      {campaigns.length === 0 ? (
        <AdminEmpty message="No campaigns yet. Compose one, send yourself a test, and it is ready to go out." />
      ) : (
        /*
         * One row per campaign, the whole row opening it: name, subject, a
         * status pill, its type and list, and the moment it went (or is due).
         * (prompts/admin-redesign-stage-6.md, 6c)
         */
        <ul data-admin-results="" className="overflow-hidden rounded-lg border border-ground-border bg-stone">
          {campaigns.map((campaign) => {
            const status = STATUS[campaign.status] ?? { label: campaign.status, tone: "border-ground-border text-ground-muted" };
            const editable = isEditable(campaign.status);
            return (
              <li key={campaign.id} className="border-b border-ground-border last:border-b-0">
                <AdminLink
                  href={localizePath(activeLocale, `/admin/campaigns/${campaign.id}`)}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 no-underline transition-colors duration-300 hover:bg-ground-bg/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] text-ground">{campaign.name}</span>
                      <span className={`inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-[11px] ${status.tone}`}>
                        {status.label}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-ground-muted">{campaign.subject}</span>
                    <span className="mt-1 block text-[12px] text-ground-muted">
                      {TYPE_LABEL[campaign.type] ?? campaign.type} · {campaign.locale === "ar" ? "Arabic" : "English"} list ·{" "}
                      {campaign.status === "SCHEDULED" && campaign.scheduledAt ? (
                        <>
                          due <LocalTimestamp iso={campaign.scheduledAt} className="text-ground-accent" />
                        </>
                      ) : campaign.sentAt ? (
                        `sent ${stamp(campaign.sentAt)}`
                      ) : (
                        "not sent"
                      )}
                    </span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-1.5 text-[12px] text-ground-muted sm:inline-flex">
                    {editable ? <Pencil size={12} strokeWidth={1.5} aria-hidden="true" /> : <Eye size={12} strokeWidth={1.5} aria-hidden="true" />}
                    {editable ? "Edit" : "View"}
                  </span>
                  <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-ground-subtle rtl:rotate-180" />
                </AdminLink>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
