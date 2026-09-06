"use server";

/**
 * The two switches that decide what the house currently offers.
 *
 * ## Why the Discovery Credit toggle is its own action
 *
 * It could have been a field on the settings form. It is not, because the two
 * writes have different shapes and different consequences: the Rewards form is a
 * page of numbers an editor tunes and saves, while the credit switch is one
 * decision with an immediate customer-facing effect on four surfaces. Giving it
 * its own action means it can sit at the top of `/admin/credits` — where the
 * credits are — instead of on a Rewards page it has nothing to do with.
 *
 * ## What OFF does, and does not
 *
 * Switching Discovery Credit off stops **issuance** and removes every
 * customer-facing mention. It does **not** refuse a credit somebody already
 * holds: that is a promise the house has already made, and withdrawing it
 * because a switch moved would be the same harm as deleting it. The enforcement
 * lives in `issue_discovery_credits()`, not here — one gate, which no caller can
 * forget.
 *
 * ## Trust model
 *
 * A Server Action is a public HTTP endpoint. `requireAdmin()` is the first
 * statement in every export, and every field is parsed by
 * `schemas/rewards.ts` before it reaches Postgres, where the column checks are
 * the authority.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import { revalidateBenefits } from "@/src/lib/admin/revalidate";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { AdminActionResult } from "@/src/schemas/admin";
import { benefitSettingsSchema } from "@/src/schemas/rewards";

import { UNCONFIGURED, fieldErrorsFrom, type PostgresErrorLike } from "./shared";

/**
 * `"BenefitSetting"` refusals, in the desk's language.
 *
 * `benefit_minimum_reachable` is the one an editor will actually hit, and the
 * Zod schema catches it first with the message beside the field. This is the
 * backstop for a write that reached Postgres another way.
 */
function failure(error: PostgresErrorLike): AdminActionResult {
  if (error.message.includes("benefit_minimum_reachable")) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: {
        minRedeemPoints:
          "The minimum cannot be below one redemption step — nobody could ever reach it.",
      },
    };
  }

  return {
    ok: false,
    message: "The database refused that change. The details are in the server log.",
  };
}

/** The whole Rewards page, saved as one row. */
export async function saveBenefitSettings(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = benefitSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase
    .from("BenefitSetting")
    .update({ ...parsed.data, updatedAt: new Date().toISOString() })
    .eq("id", "default");

  if (error) {
    console.error(`[admin] saveBenefitSettings rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  revalidateBenefits();
  console.info(
    `[admin] benefits saved by ${actor.email} — rewards ${parsed.data.rewardsEnabled ? "on" : "off"}, signup ${parsed.data.signupBenefit}`,
  );

  return { ok: true, slug: "default", message: "Rewards settings saved." };
}

/** The permanent Discovery Credit switch. One decision, one action. */
export async function setDiscoveryCreditEnabled(
  enabled: boolean,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase
    .from("BenefitSetting")
    .update({
      discoveryCreditEnabled: enabled,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", "default");

  if (error) {
    console.error(
      `[admin] setDiscoveryCreditEnabled rejected (${actor.email}): ${error.message}`,
    );
    return failure(error as PostgresErrorLike);
  }

  revalidateBenefits();
  console.info(
    `[admin] Discovery Credit switched ${enabled ? "on" : "off"} by ${actor.email}`,
  );

  return {
    ok: true,
    slug: "default",
    message: enabled
      ? "Discovery Credit is on. New Discovery Set purchases will earn a credit."
      : "Discovery Credit is off. New purchases earn nothing and the messaging is withdrawn; credits already held are untouched.",
  };
}
