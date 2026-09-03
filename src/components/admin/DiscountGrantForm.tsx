"use client";

/**
 * Inviting an address to an invitation-only code, and withdrawing an invitation.
 *
 * ## Why the screen needed this
 *
 * A code with `requiresGrant` is redeemable only by an address that holds a
 * grant, and nothing in the dashboard could issue one — the welcome flows write
 * grants, but only ever for the single campaign flagged as *the* welcome offer.
 * So every other invitation-only code refused everybody, permanently, and this
 * page said so ("Nobody can redeem this code until one is") without offering a
 * way out of it.
 *
 * ## What it does not do
 *
 * Decide eligibility. The address goes to `issue_discount_grant()`, which
 * normalises it, checks the code is actually invitation-only, and caps the
 * window at the campaign's own end date. Checkout still runs the same
 * `resolve_discount()` ladder against it afterwards.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  issueDiscountGrant,
  revokeDiscountGrant,
} from "@/src/actions/admin/discounts";
import { AdminButton, AdminInput, AdminNotice } from "@/src/components/admin/fields";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";

export default function DiscountGrantForm({ code }: { code: string }) {
  const router = useRouter();
  const { toast } = useAdminToast();

  const [email, setEmail] = useState("");
  const [days, setDays] = useState("");
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function submit() {
    setResult(null);

    startTransition(async () => {
      const outcome = await issueDiscountGrant({
        code,
        email,
        expiresInDays: days,
      });

      // Successes leave, failures stay — see `admin-toast-provider.tsx`.
      if (outcome.ok) toast(outcome.message);
      setResult(outcome.ok ? null : outcome);

      if (outcome.ok) {
        setEmail("");
        setDays("");
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-4 md:space-y-6"
    >
      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>
          {result.message}
        </AdminNotice>
      ) : null}

      <AdminInput
        id="email"
        label="Email address"
        value={email}
        onChange={setEmail}
        error={fieldErrors.email}
        hint="The address that will be able to redeem this code. Nobody else can."
      />

      <AdminInput
        id="expiresInDays"
        label="Valid for, in days"
        value={days}
        onChange={setDays}
        error={fieldErrors.expiresInDays}
        hint="Leave empty to let it run until the campaign itself ends."
      />

      <AdminButton type="submit" disabled={isPending}>
        {isPending ? "Inviting" : "Issue invitation"}
      </AdminButton>
    </form>
  );
}

/**
 * Withdrawing one, armed then confirmed.
 *
 * Only offered on an unused grant: a spent one is part of the redemption trail,
 * and `revoke_discount_grant()` refuses it regardless of what this renders.
 */
export function DiscountGrantRevokeButton({
  code,
  grantId,
}: {
  code: string;
  grantId: string;
}) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!armed) {
      setArmed(true);
      return;
    }

    setArmed(false);

    startTransition(async () => {
      const outcome = await revokeDiscountGrant({ code, grantId });
      toast(outcome.message);
      if (outcome.ok) router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={submit}
      onBlur={() => setArmed(false)}
      className={`cursor-pointer bg-transparent p-0 font-heading text-[10px] uppercase tracking-[0.16em] underline-offset-4 transition-colors duration-300 hover:underline disabled:opacity-40 ${
        armed ? "text-danger" : "text-ground-muted hover:text-ground-accent"
      }`}
    >
      {armed ? "Confirm" : "Withdraw"}
    </button>
  );
}
