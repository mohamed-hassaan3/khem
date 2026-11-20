"use client";

import { arSA } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";

import SessionPublisher from "@/src/components/auth/SessionPublisher";
import { khemClerkAppearance } from "@/src/lib/clerk-appearance";
import { localizePath, type Locale } from "@/src/lib/i18n/config";

/**
 * Clerk for a signed-in visitor on a public page — loaded lazily by
 * `<SessionProvider>` only when Clerk's `__client_uat` cookie says someone is
 * signed in (prompts/clerk-load-only-where-needed.md).
 *
 * It wraps nothing but `<SessionPublisher>`: the page is not its child, so
 * Clerk arriving re-mounts nothing. Running `clerk-js` is the point — it keeps
 * the 60-second session token fresh, so the server keeps recognising the
 * customer at checkout, in the cart and in the comment form.
 *
 * **No `prefetchUI={false}` here** (it was, in d1d91f4, and that broke the
 * account pages). Clerk is a page-wide singleton: on a client-side navigation
 * from a public page into `/account`, `<KhemClerkProvider>` *reuses* the
 * instance this bridge booted. Booted without UI, `<UserProfile>` then threw
 * "Clerk was not loaded with Ui components"
 * (prompts/clerk-account-navigation-fix.md). So the background Clerk loads its
 * UI like any provider. Signed-out visitors are unaffected — they never get
 * this bridge, and load no Clerk at all.
 */
export default function ClerkSessionBridge({ locale }: { locale: Locale }) {
  return (
    <ClerkProvider
      appearance={khemClerkAppearance}
      localization={locale === "ar" ? arSA : undefined}
      signInUrl={localizePath(locale, "/sign-in")}
      signUpUrl={localizePath(locale, "/sign-up")}
      signInFallbackRedirectUrl={localizePath(locale, "/account")}
      signUpFallbackRedirectUrl={localizePath(locale, "/account")}
    >
      <SessionPublisher />
    </ClerkProvider>
  );
}
