import { arSA } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

import SessionPublisher from "@/src/components/auth/SessionPublisher";
import { khemClerkAppearance } from "@/src/lib/clerk-appearance";
import { localizePath, type Locale } from "@/src/lib/i18n/config";

/**
 * The full Clerk provider, for the routes that render Clerk's own screens:
 * `/sign-in`, `/sign-up` (`<SignIn>`, `<SignUp>`) and `/account`
 * (`<UserProfile>`, sign-out). Everywhere else Clerk is loaded only for
 * signed-in visitors, by `<ClerkSessionBridge>`
 * (prompts/clerk-load-only-where-needed.md).
 *
 * The props are what the root layout used to pass, defined once here. The
 * auth URLs are per-locale: with `as-needed` prefixing an Arabic visitor must
 * be sent to `/ar/sign-in` and returned to `/ar/account`.
 *
 * `dynamic` is deliberately not set (it would make every route under it
 * render per request); the pages that read the session call `auth()`
 * themselves. UI prefetch is left on — these pages need `@clerk/ui`.
 *
 * `<SessionPublisher>` reports the session up to `<SessionProvider>`, so the
 * header above this segment shows the right account state.
 */
export default function KhemClerkProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
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
      {children}
    </ClerkProvider>
  );
}
