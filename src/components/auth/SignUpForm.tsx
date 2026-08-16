"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  AUTH_REDIRECT_PARAM,
  sanitizeAuthRedirect,
  signInPathWithReturn,
} from "@/src/lib/auth-redirect";
import type { Locale } from "@/src/lib/i18n/config";
import { localizePath } from "@/src/lib/i18n/config";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * The sign-up form plus KHEM's marketing opt-in.
 *
 * One client component because the two are coupled: the checkbox state has to
 * be readable at the moment Clerk creates the user, and `<SignUp>` takes it
 * through `unsafeMetadata`. The preference therefore lands on the Clerk user
 * record at creation — including for a Google sign-up, where there is no form
 * submission of ours to hook.
 *
 * **Placement.** The checkbox sits directly beneath Clerk's card rather than
 * under the email input inside it. `<SignUp>` is a prebuilt component and does
 * not accept custom fields; putting it inside the form would mean rebuilding
 * the entire flow on `useSignUp` and owning password reset, MFA, OAuth
 * callbacks, and bot protection to gain one checkbox. The border and spacing
 * below make it read as the last row of the same card.
 *
 * **`unsafeMetadata` is the right bucket and the name is a warning.** It is
 * writable by the signed-in user, which is exactly right for a preference they
 * own — and exactly why nothing may ever trust it for authorization. When this
 * syncs to Supabase it is user-supplied input; see `src/services/account.ts`.
 */

export default function SignUpForm({ locale }: { locale: Locale }) {
  const dict = useDictionary();
  const searchParams = useSearchParams();
  const returnTo = sanitizeAuthRedirect(searchParams.get(AUTH_REDIRECT_PARAM));
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  return (
    <div className="flex w-full flex-col items-center">
      {/*
       * `redirect_url` is read off the URL by Clerk itself and preferred to
       * the fallback below; it is re-read here only to rebuild the sign-in
       * link, which Clerk does not carry the parameter onto. Sanitized on the
       * way through — the value is whatever the query string says.
       */}
      <SignUp
        signInUrl={signInPathWithReturn(locale, returnTo)}
        fallbackRedirectUrl={localizePath(locale, ACCOUNT_PATHS.overview)}
        unsafeMetadata={{ marketingOptIn }}
      />

      {/*
       * Flush against the card, sharing its 400px measure and its border, so
       * the row reads as the foot of the same form rather than as a detached
       * box floating beneath it. `-mt-px` collapses the doubled border where
       * the two meet.
       */}
      <label className="-mt-px flex w-full max-w-100 cursor-pointer items-start gap-3 border border-border bg-surface px-6 py-5 text-start">
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={(event) => setMarketingOptIn(event.target.checked)}
          /*
           * `accent-color` rather than a hand-built box: it keeps the native
           * checkbox — and therefore its keyboard behaviour, its focus ring,
           * and its announcement to screen readers — while painting the tick
           * in house gold.
           */
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-gold"
        />

        <span>
          <span className="block text-xs leading-relaxed text-ivory/70">
            {dict.auth.marketing.label}
          </span>

          <span className="mt-1 block text-[11px] leading-relaxed text-ivory/30">
            {dict.auth.marketing.note}
          </span>
        </span>
      </label>
    </div>
  );
}
