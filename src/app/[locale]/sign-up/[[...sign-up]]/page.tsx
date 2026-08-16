import type { Metadata } from "next";
import { Suspense } from "react";

import AuthShell from "@/src/components/auth/AuthShell";
import SignUpForm from "@/src/components/auth/SignUpForm";
import { LOCALES, isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";

/**
 * Create an account.
 *
 * Optional catch-all for the same reason as `/sign-in`: email verification and
 * SSO callbacks are served at `/sign-up/verify-email-address` and siblings.
 */

const PATH = "/sign-up";

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
      title: dict.auth.signUp.meta.title,
      description: dict.auth.signUp.meta.description,
    }),
    robots: { index: false, follow: true },
  };
}

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  return (
    <AuthShell
      eyebrow={dict.auth.signUp.eyebrow}
      heading={dict.auth.signUp.heading}
      body={dict.auth.signUp.body}
      guest={dict.auth}
    >
      {/*
       * A client island: the marketing checkbox has to be readable at the
       * moment Clerk creates the user, so it and `<SignUp>` share one
       * component. See `SignUpForm` for why the field sits beneath the card
       * rather than inside it. It also reads the sign-in return target off the
       * query string, which is why it sits behind `<Suspense>` — that is what
       * `useSearchParams()` needs for this route to stay prerendered.
       */}
      <Suspense fallback={null}>
        <SignUpForm locale={activeLocale} />
      </Suspense>
    </AuthShell>
  );
}
