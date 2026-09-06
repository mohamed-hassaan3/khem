"use client";

/**
 * The Rewards programme, as one form for one row.
 *
 * Split into the sections the specification names — Status, Signup benefit,
 * Earning, Redemption, Rules, Limits, Stacking — because that is how a marketer
 * thinks about it, and because a single flat column of nineteen fields is a
 * screen nobody reads. It is still **one write**: splitting it across screens
 * would let a half-saved pair leave the house earning at one rate and redeeming
 * at another.
 *
 * ## Every rate is shown as the sentence it produces
 *
 * "Spend 100 EGP → Earn 10 Points" is rendered live from the two fields beside
 * it, and "100 Points → EGP 50" likewise. A marketer setting a loyalty rate is
 * doing arithmetic in their head otherwise, and the field labels alone do not
 * say which way round the ratio goes.
 *
 * ## Money is entered in pounds and stored in piastres
 *
 * Every other admin form in this repository takes piastres, because every other
 * form is editing a *price* an editor already thinks of that way. A loyalty rate
 * is not a price — "spend 10000" is a rate nobody would type on purpose — so the
 * two money fields here convert at the boundary and say so in their hint.
 */

import { useState, useTransition } from "react";

import { saveBenefitSettings } from "@/src/actions/admin/benefits";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminSelect,
  AdminToggle,
} from "@/src/components/admin/fields";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { egpCompact } from "@/src/lib/admin/money";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { BenefitSettings } from "@/src/types/benefits";

const SIGNUP_OPTIONS = [
  {
    value: "WELCOME_DISCOUNT",
    label: "20% First Purchase — the welcome discount code",
  },
  { value: "REWARD_POINTS", label: "KHEM Rewards — points on the new account" },
  { value: "NONE", label: "Off — promise nothing" },
] as const;

/** Piastres in, pounds out, for a field a marketer types a rate into. */
function toPounds(cents: number): string {
  return String(Math.round(cents / 100));
}

function toCents(pounds: string): number {
  const value = Number(pounds);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export default function RewardSettingsForm({
  settings,
  /** What the live welcome campaign is worth, for the note under the choice. */
  welcomeSummary,
}: {
  settings: BenefitSettings;
  welcomeSummary: string;
}) {
  const [rewardsEnabled, setRewardsEnabled] = useState(settings.rewardsEnabled);

  const [signupBenefit, setSignupBenefit] = useState<string>(
    settings.signupBenefit,
  );
  const [signupPoints, setSignupPoints] = useState(String(settings.signupPoints));

  const [earnSpendPounds, setEarnSpendPounds] = useState(
    toPounds(settings.earnSpendInCents),
  );
  const [earnPoints, setEarnPoints] = useState(String(settings.earnPoints));
  const [earnOnDiscoverySets, setEarnOnDiscoverySets] = useState(
    settings.earnOnDiscoverySets,
  );

  const [firstPurchaseEnabled, setFirstPurchaseEnabled] = useState(
    settings.firstPurchaseEnabled,
  );
  const [firstPurchasePoints, setFirstPurchasePoints] = useState(
    String(settings.firstPurchasePoints),
  );

  const [reviewEnabled, setReviewEnabled] = useState(settings.reviewEnabled);
  const [reviewPoints, setReviewPoints] = useState(String(settings.reviewPoints));

  const [redeemPoints, setRedeemPoints] = useState(String(settings.redeemPoints));
  const [redeemValuePounds, setRedeemValuePounds] = useState(
    toPounds(settings.redeemValueInCents),
  );
  const [minRedeemPoints, setMinRedeemPoints] = useState(
    String(settings.minRedeemPoints),
  );
  const [maxPointsPerOrder, setMaxPointsPerOrder] = useState(
    settings.maxPointsPerOrder === null ? "" : String(settings.maxPointsPerOrder),
  );
  const [pointsExpiryMonths, setPointsExpiryMonths] = useState(
    settings.pointsExpiryMonths === null ? "" : String(settings.pointsExpiryMonths),
  );

  const [pointsStackWithCodes, setPointsStackWithCodes] = useState(
    settings.pointsStackWithCodes,
  );
  const [pointsStackWithPromotions, setPointsStackWithPromotions] = useState(
    settings.pointsStackWithPromotions,
  );
  const [pointsStackWithOffers, setPointsStackWithOffers] = useState(
    settings.pointsStackWithOffers,
  );
  const [pointsStackWithCredit, setPointsStackWithCredit] = useState(
    settings.pointsStackWithCredit,
  );

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  const payload = {
    // Not editable here — the switch lives on the Credits screen, beside the
    // credits it governs. Carried through so the single-row update does not
    // blank it.
    discoveryCreditEnabled: settings.discoveryCreditEnabled,
    rewardsEnabled,
    earnSpendInCents: toCents(earnSpendPounds),
    earnPoints,
    earnOnDiscoverySets,
    signupBenefit,
    signupPoints,
    firstPurchaseEnabled,
    firstPurchasePoints,
    reviewEnabled,
    reviewPoints,
    redeemPoints,
    redeemValueInCents: toCents(redeemValuePounds),
    minRedeemPoints,
    maxPointsPerOrder,
    pointsExpiryMonths,
    pointsStackWithCodes,
    pointsStackWithPromotions,
    pointsStackWithOffers,
    pointsStackWithCredit,
  };

  const { toast } = useAdminToast();

  const { markSaved } = useUnsavedGuard({
    payload,
    save: () => persist(),
    pending: isPending,
  });

  async function persist(): Promise<boolean> {
    setResult(null);

    const outcome = await saveBenefitSettings(payload);

    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);
    if (outcome.ok) markSaved();

    return outcome.ok;
  }

  // The two sentences the sections are really about, rendered from the fields
  // beside them so a marketer never has to do the arithmetic themselves.
  const earnSentence = `Spend ${egpCompact(toCents(earnSpendPounds))} → earn ${earnPoints || 0} points`;
  const redeemSentence = `${redeemPoints || 0} points → ${egpCompact(toCents(redeemValuePounds))}`;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          await persist();
        });
      }}
      className="max-w-3xl space-y-8"
    >
      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>
          {result.message}
        </AdminNotice>
      ) : null}

      <Section title="Status">
        <AdminToggle
          id="rewardsEnabled"
          label="Run KHEM Rewards"
          description="Off stops all earning and redemption and hides the points panel from every customer. Balances already earned are kept, not erased — switching back on restores them exactly."
          checked={rewardsEnabled}
          onChange={setRewardsEnabled}
        />
      </Section>

      <Section title="Signup benefit">
        <AdminSelect
          id="signupBenefit"
          label="What signing up is worth"
          value={signupBenefit}
          onChange={setSignupBenefit}
          options={[...SIGNUP_OPTIONS]}
          error={fieldErrors.signupBenefit}
          hint={
            signupBenefit === "WELCOME_DISCOUNT"
              ? `The popup and the welcome letter promise the live welcome offer — currently ${welcomeSummary}. Edit it under Discounts.`
              : signupBenefit === "REWARD_POINTS"
                ? "The popup promises points instead, no welcome code is issued, and a new account is credited the amount below. Codes already granted stay valid."
                : "The popup still invites people to the list but promises nothing, no welcome code is issued, and registering awards nothing. Codes already granted stay valid."
          }
        />

        {signupBenefit === "REWARD_POINTS" ? (
          <>
            <AdminInput
              id="signupPoints"
              label="Points on a new account"
              type="number"
              value={signupPoints}
              onChange={setSignupPoints}
              error={fieldErrors.signupPoints}
              hint="Awarded once, the first time an account is created."
            />

            {/*
              The one inconsistent pair this form can produce, surfaced where it
              can be fixed rather than silently resolved.

              The popup honours the choice above and promises points either way —
              a setting that quietly did the opposite of what it says would be
              worse than the mismatch. But nothing would actually be awarded
              while the programme is off, so the desk is told plainly, next to
              the switch that fixes it.
            */}
            {!rewardsEnabled ? (
              <AdminNotice tone="error">
                The popup will promise {signupPoints || 0} points, but Rewards is
                switched off above — so nothing would actually be awarded. Turn
                the programme on, or choose a different signup benefit.
              </AdminNotice>
            ) : null}
          </>
        ) : null}
      </Section>

      <Section title="Earning" sentence={earnSentence}>
        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="earnSpendInCents"
            label="Spend (EGP)"
            type="number"
            value={earnSpendPounds}
            onChange={setEarnSpendPounds}
            error={fieldErrors.earnSpendInCents}
            hint="In pounds, not piastres — this is a rate, not a price."
          />
          <AdminInput
            id="earnPoints"
            label="Points earned"
            type="number"
            value={earnPoints}
            onChange={setEarnPoints}
            error={fieldErrors.earnPoints}
          />
        </div>

        <AdminToggle
          id="earnOnDiscoverySets"
          label="Discovery Sets earn points"
          description="On, a Discovery Set earns like any other purchase — as well as its credit. Off, only the rest of the basket earns."
          checked={earnOnDiscoverySets}
          onChange={setEarnOnDiscoverySets}
        />

        <p className="text-[12px] leading-relaxed text-ground-muted">
          Points are always earned on what was <strong>actually paid</strong> for
          merchandise — after any promotion, offer, code, credit or points on the
          same order, and never on delivery. A 1,470 bottle bought with a 10%
          code earns on 1,323.
        </p>
      </Section>

      <Section title="Rules">
        <AdminToggle
          id="firstPurchaseEnabled"
          label="First purchase bonus"
          description="A one-off bonus the first time a customer's order is paid. Awarded once per customer, ever."
          checked={firstPurchaseEnabled}
          onChange={setFirstPurchaseEnabled}
        />

        {firstPurchaseEnabled ? (
          <AdminInput
            id="firstPurchasePoints"
            label="First purchase points"
            type="number"
            value={firstPurchasePoints}
            onChange={setFirstPurchasePoints}
            error={fieldErrors.firstPurchasePoints}
          />
        ) : null}

        <AdminToggle
          id="reviewEnabled"
          label="Review bonus"
          description="Awarded when a signed-in customer's review is published with a rating. Once per product per customer, so a second review of the same bottle earns nothing."
          checked={reviewEnabled}
          onChange={setReviewEnabled}
        />

        {reviewEnabled ? (
          <AdminInput
            id="reviewPoints"
            label="Review points"
            type="number"
            value={reviewPoints}
            onChange={setReviewPoints}
            error={fieldErrors.reviewPoints}
          />
        ) : null}
      </Section>

      <Section title="Redemption" sentence={redeemSentence}>
        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="redeemPoints"
            label="Points in a step"
            type="number"
            value={redeemPoints}
            onChange={setRedeemPoints}
            error={fieldErrors.redeemPoints}
          />
          <AdminInput
            id="redeemValueInCents"
            label="Worth (EGP)"
            type="number"
            value={redeemValuePounds}
            onChange={setRedeemValuePounds}
            error={fieldErrors.redeemValueInCents}
            hint="In pounds. 100 points → EGP 50 is roughly 5% back at the default earning rate."
          />
        </div>
      </Section>

      <Section title="Limits">
        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="minRedeemPoints"
            label="Minimum redemption"
            type="number"
            value={minRedeemPoints}
            onChange={setMinRedeemPoints}
            error={fieldErrors.minRedeemPoints}
            hint="Cannot be below one step, or nobody could ever reach it."
          />
          <AdminInput
            id="maxPointsPerOrder"
            label="Most points per order"
            type="number"
            value={maxPointsPerOrder}
            onChange={setMaxPointsPerOrder}
            error={fieldErrors.maxPointsPerOrder}
            hint="Leave empty for no cap."
          />
        </div>

        <AdminInput
          id="pointsExpiryMonths"
          label="Points expire after (months)"
          type="number"
          value={pointsExpiryMonths}
          onChange={setPointsExpiryMonths}
          error={fieldErrors.pointsExpiryMonths}
          hint="Leave empty and points never lapse. Counted from the moment each lot was earned, and the oldest are always spent first — so a balance lapses gradually rather than all at once."
        />
      </Section>

      <Section title="Combining">
        <p className="text-[12px] leading-relaxed text-ground-muted">
          KHEM runs <strong>one promotional mechanism per order</strong> by
          default. Each switch below permits points beside one other benefit;
          with it off the checkout refuses the pair and tells the customer which
          one is in the way. Earning is never affected — a qualifying order earns
          points whatever else reduced it.
        </p>

        <AdminToggle
          id="pointsStackWithCodes"
          label="Points may be spent beside a discount code"
          checked={pointsStackWithCodes}
          onChange={setPointsStackWithCodes}
        />
        <AdminToggle
          id="pointsStackWithPromotions"
          label="Points may be spent on a promoted bottle"
          checked={pointsStackWithPromotions}
          onChange={setPointsStackWithPromotions}
        />
        <AdminToggle
          id="pointsStackWithOffers"
          label="Points may be spent beside an offer"
          checked={pointsStackWithOffers}
          onChange={setPointsStackWithOffers}
        />
        <AdminToggle
          id="pointsStackWithCredit"
          label="Points may be spent beside a Discovery Credit"
          checked={pointsStackWithCredit}
          onChange={setPointsStackWithCredit}
        />
      </Section>

      <AdminButton type="submit" disabled={isPending}>
        {isPending ? "Saving" : "Save settings"}
      </AdminButton>
    </form>
  );
}

/**
 * A titled group, with the sentence it produces where there is one.
 *
 * The sentence is the section's whole point on the two rate screens, so it is
 * set beside the heading in gold rather than beneath the fields where it would
 * read as a hint.
 */
function Section({
  title,
  sentence,
  children,
}: {
  title: string;
  sentence?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-ground-border pt-8 first:border-t-0 first:pt-0 md:space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          {title}
        </h2>
        {sentence ? (
          <p className="font-heading text-[12px] tracking-[0.08em] text-ground-accent">
            {sentence}
          </p>
        ) : null}
      </div>

      {children}
    </section>
  );
}
