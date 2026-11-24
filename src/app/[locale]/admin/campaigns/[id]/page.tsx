import { notFound } from "next/navigation";

import CampaignAudienceList from "@/src/components/admin/CampaignAudienceList";
import CampaignSendLog from "@/src/components/admin/CampaignSendLog";
import CampaignDispatch from "@/src/components/admin/CampaignDispatch";
import CampaignForm from "@/src/components/admin/CampaignForm";
import CampaignRecord from "@/src/components/admin/CampaignRecord";
import CampaignPreview from "@/src/components/admin/CampaignPreview";
import { AdminPageHeader, AdminBackLink } from "@/src/components/admin/AdminTable";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  getCampaign,
  listCampaignAudience,
  listCampaignSends,
  subscriberCount,
} from "@/src/services/admin/campaigns";
import { isEditable } from "@/src/types/campaign";
import { requireAdmin } from "@/src/lib/admin/auth";

/**
 * One campaign: its letter, and what has become of it.
 *
 * The preview sits beneath the editor rather than beside it, deliberately. A
 * letter is 600px wide and reads top to bottom; squeezed into half a dashboard
 * it would be a thumbnail of a thing whose whole purpose is to be read.
 *
 * ## Two screens, one route
 *
 * A draft gets the editor. A campaign that has begun sending gets
 * `CampaignRecord` — the same fields, printed rather than typed into, with what
 * actually happened above them. The database refuses to edit a sent campaign
 * either way; this is about not offering.
 */
export const dynamic = "force-dynamic";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  // The layout's gate does not cover a page on client navigation — see requireAdmin().
  await requireAdmin();

  const { locale, id } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [campaign, en, ar] = await Promise.all([
    getCampaign(id),
    subscriberCount("en"),
    subscriberCount("ar"),
  ]);

  if (!campaign) notFound();

  const editable = isEditable(campaign.status);

  // Every address the saved audience reaches, for the desk to check and trim
  // before sending (0081). Only while the campaign can still change.
  const audienceMembers = editable ? await listCampaignAudience(campaign.id) : [];
  // After sending: every address it claimed and what became of each letter.
  const sends = editable ? [] : await listCampaignSends(campaign.id);

  return (
    <>
      <AdminBackLink href={localizePath(isLocale(locale) ? locale : "en", "/admin/campaigns")}>Email campaigns</AdminBackLink>
      <AdminPageHeader
        title={campaign.name}
        /*
         * The figures for a sent campaign live in `CampaignRecord`, not here:
         * one screen saying the same numbers twice is one that eventually says
         * them differently.
         */
        description={
          editable
            ? `Not yet sent. As selected it would reach ${
                campaign.audience.total
              } ${
                campaign.audience.total === 1 ? "address" : "addresses"
              } today — choose the audience below before sending.`
            : campaign.subject
        }
      />

      <div className="space-y-10">
        {editable ? (
          <>
            {/*
              * Sending sits above the editor, not below it: it is the decision
              * this screen exists for, and the audience figure beside it is
              * what the desk should read before anything else.
              */}
            <div className="max-w-3xl">
              <CampaignDispatch
                campaign={campaign}
                audienceList={
                  <CampaignAudienceList campaignId={campaign.id} members={audienceMembers} />
                }
              />
            </div>

            <CampaignForm
              campaign={campaign}
              locale={activeLocale}
              audienceEn={en}
              audienceAr={ar}
            />
          </>
        ) : (
          <>
            {/*
              * Still shown while SENDING: a run is bounded, so a large campaign
              * finishes across several and the desk needs the control that
              * continues it. A SENT one has nothing left to press, and
              * `CampaignDispatch` renders its own closing summary instead.
              */}
            {campaign.status === "SENDING" ? (
              <div className="max-w-3xl">
                <CampaignDispatch campaign={campaign} />
              </div>
            ) : null}

            <CampaignRecord campaign={campaign} />

            <CampaignSendLog name={campaign.name} rows={sends} />
          </>
        )}

        <div className="max-w-3xl">
          <CampaignPreview campaign={campaign} />
        </div>
      </div>
    </>
  );
}
