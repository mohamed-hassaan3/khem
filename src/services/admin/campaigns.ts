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
 * `campaign_audience_count()` answers "how many would this reach", and that is
 * all any screen needs. The addresses themselves are read only by the dispatch,
 * which claims them as it goes — a dashboard that could enumerate the list would
 * be a second place subscriber addresses are rendered.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  CAMPAIGN_COLUMNS,
  parseList,
  toCampaign,
} from "@/src/schemas/db/campaigns";
import type { Campaign, CampaignWithProgress } from "@/src/types/campaign";

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

/** How many subscribed addresses a campaign in this language would reach. */
export async function audienceCount(locale: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;

  const { data, error } = await supabase.rpc("campaign_audience_count", {
    campaign_locale: locale,
  });

  if (error) {
    logFailure("audienceCount", error.message);
    return 0;
  }

  return typeof data === "number" ? data : 0;
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

  const [{ count: claimed }, { count: delivered }, audienceNow] = await Promise.all([
    supabase
      .from("campaign_sends")
      .select("campaignId", { count: "exact", head: true })
      .eq("campaignId", id),
    supabase
      .from("campaign_sends")
      .select("campaignId", { count: "exact", head: true })
      .eq("campaignId", id)
      .not("sentAt", "is", null),
    audienceCount(campaign.locale),
  ]);

  return {
    ...campaign,
    claimed: claimed ?? 0,
    delivered: delivered ?? 0,
    audienceNow,
  };
}
