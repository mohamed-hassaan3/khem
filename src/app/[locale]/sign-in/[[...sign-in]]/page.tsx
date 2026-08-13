import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

import AuthShell from "@/src/components/auth/AuthShell";
import { LOCALES, isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";

/**
 * Sign in.
 *
 * The optional catch-all segment is Clerk's requirement, not a stylistic
 * choice: multi-step flows (password reset, MFA challenge, SSO callback) are
 * served at `/sign-in/factor-one` and siblings, and a plain `page.tsx` would
 * 404 the moment a visitor forgets their password.
 *
 * This is also the signed-out gate for `/account/*` — `src/proxy.ts` redirects
 * here, and `<AuthShell>` offers the guest routes beneath the form so the
 * redirect never dead-ends a visitor who only wanted to browse.
 *
 * Static: the shell is identical for every visitor and Clerk's component does
 * its own work on the client. Nothing here reads the session.
 */

const PATH = "/sign-in";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  return {
    ...localeMetadata({
      locale: activeLocale,
      path: PATH,
      title: dict.auth.signIn.meta.title,
      description: dict.auth.signIn.meta.description,
    }),
    // A credential form has nothing to index, and indexing it invites
    // phishing lookalikes to rank beside it. Links out are still followed.
    robots: { index: false, follow: true },
  };
}

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  return (
    <AuthShell
      eyebrow={dict.auth.signIn.eyebrow}
      heading={dict.auth.signIn.heading}
      body={dict.auth.signIn.body}
      guest={dict.auth}
    >
      {/*
       * The redirect targets are locale-prefixed here as well as on the
       * provider: this page is reachable directly, and a visitor who lands on
       * `/ar/sign-in` from a bookmark must still be returned into the Arabic
       * tree afterwards.
       */}
      <SignIn
        signUpUrl={localizePath(activeLocale, "/sign-up")}
        fallbackRedirectUrl={localizePath(activeLocale, "/account")}
      />
    </AuthShell>
  );
}
