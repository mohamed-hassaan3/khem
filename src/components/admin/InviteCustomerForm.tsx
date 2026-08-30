"use client";

/**
 * Inviting somebody to open an account.
 *
 * Two fields, because an invitation is two decisions: who, and in which
 * language the house writes to them. Everything else about the account is
 * theirs to fill in when they accept.
 *
 * The form holds no authority. `inviteCustomer` calls `requireAdmin()` as its
 * first statement, so rendering this component grants nothing — it is an
 * affordance for somebody who already has the right, exactly as
 * `CreditAdjustForm` beside it.
 *
 * Success clears the field rather than keeping the address on screen: the next
 * thing the desk does here is invite somebody else, and a form that still shows
 * the last person invited is one that eventually invites them twice.
 */

import { useState, useTransition } from "react";

import { inviteCustomer } from "@/src/actions/admin/invitations";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminSelect,
} from "@/src/components/admin/fields";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
] as const;

export default function InviteCustomerForm() {
  const [email, setEmail] = useState("");
  const [locale, setLocale] = useState<string>("en");
  const { toast } = useAdminToast();

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function submit() {
    setResult(null);

    startTransition(async () => {
      const outcome = await inviteCustomer({ email, locale });
      // Successes leave, failures stay — see `admin-toast-provider.tsx`.
      if (outcome.ok) toast(outcome.message);
      setResult(outcome.ok ? null : outcome);
      if (outcome.ok) setEmail("");
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="mb-8 max-w-xl space-y-4 border border-ground-border bg-stone/60 px-5 py-5 md:px-6 md:py-6"
    >
      <div>
        <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-ground-accent">
          Invite a customer
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-ground-muted">
          They receive KHEM&rsquo;s own invitation letter. Accepting it opens their
          account and sends the welcome — with the welcome voucher, if one is running.
        </p>
      </div>

      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>
          {result.message}
        </AdminNotice>
      ) : null}

      <AdminInput
        id="inviteEmail"
        label="Email address"
        value={email}
        onChange={setEmail}
        error={fieldErrors.email}
      />

      <AdminSelect
        id="inviteLocale"
        label="Language"
        value={locale}
        onChange={setLocale}
        options={LANGUAGES}
        error={fieldErrors.locale}
        hint="The invitation and the welcome letter are both written in this language."
      />

      <AdminButton type="submit" disabled={isPending || email.trim() === ""}>
        {isPending ? "Sending" : "Send Invitation"}
      </AdminButton>
    </form>
  );
}
