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
 * `prefetchUI={false}` is safe **here and only here**: this provider renders no
 * prebuilt Clerk component. (Set on a provider that does render `<SignIn>`,
 * it stops `@clerk/ui` loading at all and the form crashes — see
 * prompts/lcp-priority-and-clerk-weight.md, "Outcome".) The sign-in, sign-up
 * and account pages have their own full provider (`<KhemClerkProvider>`).
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
      prefetchUI={false}
    >
      <SessionPublisher />
    </ClerkProvider>
  );
}
