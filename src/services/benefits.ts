import "server-only";

/**
 * What the house currently offers — the one `"BenefitSetting"` row.
 *
 * ## Which key, and why
 *
 * The **publishable** key, like every other storefront read.
 * `supabase/sql/0058_benefit_settings.sql` publishes the whole row to `anon`
 * deliberately: the popup says what signing up is worth, the Discovery banner
 * says whether a Set earns a credit, and the account panel says what a point
 * converts to. All of it is already printed on pages anybody can open, and none
 * of it names a person.
 *
 * ## Nothing here may hang the site
 *
 * {@link getSignupBenefit} is awaited by the **root layout**, so it sits in
 * front of every page. It is bounded by {@link boundedRead} for the reason that
 * module opens with, and it falls back to {@link BENEFIT_FALLBACK} — which is
 * *today's behaviour*, not a safe-looking off state. A database that stops
 * answering must not silently stop paying customers, and must not silently start.
 *
 * ## Request-scoped memoisation
 *
 * `cache()`, because the row is wanted by the layout's popup, by the Discovery
 * category page, by the set detail page and by the account panel — three of
 * which can appear in one render. One query per request.
 */

import { cache } from "react";

import { boundedRead } from "@/src/lib/db/bounded-read";
import { getSupabasePublic } from "@/src/lib/supabase";
import {
  BENEFIT_FALLBACK,
  BENEFIT_SETTING_COLUMNS,
  toBenefitSettings,
} from "@/src/schemas/db/benefits";
import { toWelcomeOfferSummary } from "@/src/schemas/db/marketing";
import type { BenefitSettings, SignupBenefit } from "@/src/types/benefits";

export { BENEFIT_FALLBACK };

export const getBenefitSettings = cache(async function getBenefitSettings(): Promise<
  BenefitSettings
> {
  const supabase = getSupabasePublic();
  if (!supabase) return BENEFIT_FALLBACK;

  const { data, error } = await boundedRead(
    "benefits",
    "getBenefitSettings",
    supabase
      .from("BenefitSetting")
      .select(BENEFIT_SETTING_COLUMNS)
      .eq("id", "default")
      .maybeSingle(),
  );

  if (error) {
    console.error(`[benefits] getBenefitSettings failed: ${error.message}`);
    return BENEFIT_FALLBACK;
  }

  return toBenefitSettings(data) ?? BENEFIT_FALLBACK;
});

/**
 * What a new subscriber or a new account is offered, in the shape the popup
 * renders.
 *
 * A discriminated union rather than three loose fields, so the component cannot
 * print the wrong branch — under `NONE` there is no offer to print, which is
 * what makes "no stale 20% OFF messaging" a type error rather than a thing to
 * remember.
 *
 * The percentage under `WELCOME_DISCOUNT` still comes from `welcome_offer()`,
 * which `supabase/sql/0059_rewards.sql` gates on this same mode. Both gates
 * agreeing is not redundancy: the function's gate is what stops every *other*
 * reader — the dashboard's echo, a future email — advertising a campaign the
 * house has switched away from.
 */
export const getSignupBenefit = cache(async function getSignupBenefit(): Promise<
  SignupBenefit
> {
  const settings = await getBenefitSettings();

  if (settings.signupBenefit === "NONE") {
    return { mode: "NONE" };
  }

  if (settings.signupBenefit === "REWARD_POINTS") {
    /*
     * The chosen mode **is** the promise, and it is honoured whether or not
     * Rewards is currently switched on.
     *
     * This used to fall back to `NONE` when `rewardsEnabled` was false, on the
     * reasoning that promising points nobody would be given is a lie. The
     * reasoning was right and the remedy was wrong: it made the popup fall
     * silent the moment an editor picked Points before switching the programme
     * on, so a deliberate choice in the dashboard produced a blank panel with
     * nothing anywhere saying why.
     *
     * A setting that quietly does the opposite of what it says is worse than an
     * inconsistent pair. So the storefront renders what was chosen, and the
     * inconsistency is surfaced where it can actually be fixed — the Rewards
     * form warns when Points is selected while the programme is off.
     */
    return { mode: "REWARD_POINTS", points: settings.signupPoints };
  }

  const supabase = getSupabasePublic();
  if (!supabase) return { mode: "WELCOME_DISCOUNT", offer: null };

  const { data, error } = await boundedRead(
    "benefits",
    "welcome_offer",
    supabase.rpc("welcome_offer"),
  );

  if (error) {
    console.error(`[benefits] welcome_offer failed: ${error.message}`);
    return { mode: "WELCOME_DISCOUNT", offer: null };
  }

  // `welcome_offer()` returns a set — zero rows when nothing is running — so
  // the result is an array and the first row is the answer.
  return {
    mode: "WELCOME_DISCOUNT",
    offer: toWelcomeOfferSummary(Array.isArray(data) ? data[0] : data),
  };
});
