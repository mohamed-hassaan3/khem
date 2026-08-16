"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

import {
  AUTH_REDIRECT_PARAM,
  sanitizeAuthRedirect,
  signUpPathWithReturn,
} from "@/src/lib/auth-redirect";
import type { Locale } from "@/src/lib/i18n/config";
import { localizePath } from "@/src/lib/i18n/config";
import { ACCOUNT_PATHS } from "@/src/lib/routes";

/**
 * Clerk's sign-in card, wired to return the visitor where they came from.
 *
 * **Why a client island rather than the page.** The return target arrives as a
 * query parameter, and reading `searchParams` in the page would opt the whole
 * route into dynamic rendering — a per-request invocation for a form that is
 * identical for everyone. Read here instead and `/sign-in` stays prerendered.
 *
 * **What is passed and what is not.** `<SignIn>` needs no redirect prop for the
 * happy path: Clerk reads `redirect_url` off the URL itself and prefers it to
 * `fallbackRedirectUrl`, and preserves it across factor-one, SSO callback, and
 * verification hops. What it does *not* do is carry the parameter onto a
 * `signUpUrl` we hand it, so that link is rebuilt here — otherwise a visitor
 * who decides mid-flow that they need an account loses their place.
 *
 * The parameter is sanitized on the way in as well as on the way out
 * (`src/lib/auth-redirect.ts`): the value on the URL is attacker-supplied, and
 * this is the component that hands it back to Clerk.
 */

export default function SignInForm({ locale }: { locale: Locale }) {
  const searchParams = useSearchParams();
  const returnTo = sanitizeAuthRedirect(searchParams.get(AUTH_REDIRECT_PARAM));

  return (
    <SignIn
      signUpUrl={signUpPathWithReturn(locale, returnTo)}
      /*
       * Only consulted when the URL carries no usable `redirect_url` — a
       * bookmarked `/sign-in`, or a crafted target the sanitizer rejected.
       */
      fallbackRedirectUrl={localizePath(locale, ACCOUNT_PATHS.overview)}
    />
  );
}
