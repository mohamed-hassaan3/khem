import { Eye, Pencil, Plus } from "lucide-react";

import AdminLink from "@/src/components/admin/AdminLink";
import LocalTimestamp from "@/src/components/admin/LocalTimestamp";
import {
  AdminCell,
  AdminEmpty,
  AdminLinkButton,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listCampaigns, subscriberCount } from "@/src/services/admin/campaigns";
import { isEditable } from "@/src/types/campaign";

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

function stamp(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
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
        <AdminTable
          headers={[
            "Campaign",
            "Type",
            "List",
            "Status",
            "Sent / scheduled",
            { label: "Open", hidden: true },
          ]}
        >
          {campaigns.map((campaign) => (
            <AdminRow key={campaign.id}>
              <AdminCell>
                <AdminLink
                  href={localizePath(activeLocale, `/admin/campaigns/${campaign.id}`)}
                  className="text-ground no-underline transition-colors duration-300 hover:text-ground-accent"
                >
                  {campaign.name}
                </AdminLink>
                <span className="mt-0.5 block text-[11px] text-ground-muted">
                  {campaign.subject}
                </span>
              </AdminCell>

              <AdminCell>{campaign.type.replace(/_/g, " ").toLowerCase()}</AdminCell>
              <AdminCell>{campaign.locale === "ar" ? "Arabic" : "English"}</AdminCell>
              <AdminCell>{campaign.status.toLowerCase()}</AdminCell>

              {/*
                * One column, two facts, and which one it is is never left to be
                * inferred: a scheduled campaign shows the moment it is due — in
                * the reader's own zone, with the zone named — and everything
                * else shows the day it went. A row that said only "scheduled"
                * gave the desk no way to check what had been set.
                */}
              <AdminCell>
                {campaign.status === "SCHEDULED" && campaign.scheduledAt ? (
                  <>
                    <span className="block text-[11px] uppercase tracking-[0.18em] text-ground-muted">
                      Due
                    </span>
                    <LocalTimestamp
                      iso={campaign.scheduledAt}
                      className="tabular-nums text-ground-accent-soft"
                    />
                  </>
                ) : (
                  stamp(campaign.sentAt)
                )}
              </AdminCell>

              <AdminCell>
                {/*
                  * Named for what it does. A campaign that has gone out cannot
                  * be edited, and a row offering to "edit" it would promise
                  * something the database refuses — so it says View, and opens
                  * the record.
                  */}
                <AdminLink
                  href={localizePath(activeLocale, `/admin/campaigns/${campaign.id}`)}
                  className="inline-flex items-center gap-2 whitespace-nowrap border border-ground-border px-4 py-2 font-heading text-[9px] uppercase tracking-[0.18em] text-ground-muted no-underline transition-colors duration-300 hover:border-gold/40 hover:text-ground-accent"
                >
                  {isEditable(campaign.status) ? (
                    <>
                      <Pencil size={11} strokeWidth={1.5} aria-hidden="true" />
                      Edit
                    </>
                  ) : (
                    <>
                      <Eye size={11} strokeWidth={1.5} aria-hidden="true" />
                      View
                    </>
                  )}
                </AdminLink>
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </>
  );
}
