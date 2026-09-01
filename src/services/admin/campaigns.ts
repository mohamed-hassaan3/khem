import "server-only";

/**
 * Campaign reads for the dashboard.
 *
 * Secret key, behind `requireAdmin()`, same failure posture as its neighbours:
 * log the provider's message and return an empty projection rather than throwing
 * into a page.
 *
 * ## The audience is counted, never listed here
 *
 * `campaign_audience_breakdown()` answers "how many would this reach, and from
 * where", and that is all any screen needs. The addresses themselves are read
 * only by the dispatch, which claims them as it goes — a dashboard that could
 * enumerate the list would be a second place subscriber addresses are rendered.
 *
 * The one exception is `listCampaignRecipients()`, which returns the addresses
 * somebody **typed into this campaign**. Those are not the house's list; they
 * are this campaign's own field, and an editor who cannot see what they typed
 * cannot correct a mistake in it.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  CAMPAIGN_COLUMNS,
  parseList,
  toCampaign,
} from "@/src/schemas/db/campaigns";
import type {
  AudienceBreakdown,
  Campaign,
  CampaignWithProgress,
} from "@/src/types/campaign";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

/** Every campaign, newest first. */
export async function listCampaigns(): Promise<Campaign[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .order("createdAt", { ascending: false });

  if (error) {
    logFailure("listCampaigns", error.message);
    return [];
  }

  return parseList(data, toCampaign);
}

/**
 * How many people are on the Inner Circle list in one language.
 *
 * The size of a *list*, which is what the campaigns index and the composer show
 * as context — deliberately not called an audience. An audience belongs to a
 * campaign and depends on which sources it selected;
 * {@link audienceBreakdown} is the only thing that answers that, so a screen
 * cannot accidentally show one number and send another.
 */
export async function subscriberCount(locale: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("NewsletterSubscriber")
    .select("id", { count: "exact", head: true })
    .eq("status", "SUBSCRIBED")
    .eq("locale", locale);

  if (error) {
    logFailure("subscriberCount", error.message);
    return 0;
  }

  return count ?? 0;
}

const NO_AUDIENCE: AudienceBreakdown = {
  subscribers: 0,
  customers: 0,
  specific: 0,
  total: 0,
};

/**
 * Who this campaign would reach if it went now.
 *
 * Straight from `campaign_audience_breakdown()`, which counts the very rows
 * `begin_campaign_dispatch()` claims. One definition, so the figure in the
 * confirmation and the number of letters that leave cannot disagree.
 */
export async function audienceBreakdown(
  campaignId: string,
): Promise<AudienceBreakdown> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_AUDIENCE;

  const { data, error } = await supabase.rpc("campaign_audience_breakdown", {
    campaign_id: campaignId,
  });

  if (error) {
    logFailure("audienceBreakdown", error.message);
    return NO_AUDIENCE;
  }

  const row = data as Partial<Record<keyof AudienceBreakdown, unknown>> | null;
  const read = (key: keyof AudienceBreakdown): number => {
    const value = Number(row?.[key]);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  };

  return {
    subscribers: read("subscribers"),
    customers: read("customers"),
    specific: read("specific"),
    total: read("total"),
  };
}

/** The addresses typed into this campaign by hand, in the order they were added. */
export async function listCampaignRecipients(
  campaignId: string,
): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("campaign_recipients")
    .select("email")
    .eq("campaignId", campaignId)
    .order("createdAt");

  if (error) {
    logFailure("listCampaignRecipients", error.message);
    return [];
  }

  return (data ?? []).flatMap((row) =>
    typeof row.email === "string" ? [row.email] : [],
  );
}

/**
 * One campaign, with what has become of it.
 *
 * `claimed` and `delivered` are counted from `campaign_sends` rather than stored
 * on the campaign — the same reason `0028` counts redemptions instead of keeping
 * a `timesUsed` column: a counter beside the rows it counts is a second record
 * of one fact.
 */
export async function getCampaign(
  id: string,
): Promise<CampaignWithProgress | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logFailure("getCampaign", error.message);
    return null;
  }

  const campaign = toCampaign(data);
  if (!campaign) return null;

  const [{ count: claimed }, { count: delivered }, audience, recipients] =
    await Promise.all([
      supabase
        .from("campaign_sends")
        .select("campaignId", { count: "exact", head: true })
        .eq("campaignId", id),
      supabase
        .from("campaign_sends")
        .select("campaignId", { count: "exact", head: true })
        .eq("campaignId", id)
        .not("sentAt", "is", null),
      audienceBreakdown(id),
      listCampaignRecipients(id),
    ]);

  return {
    ...campaign,
    claimed: claimed ?? 0,
    delivered: delivered ?? 0,
    audience,
    recipients,
  };
}
