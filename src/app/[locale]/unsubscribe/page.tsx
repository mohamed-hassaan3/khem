import type { Metadata } from "next";
import Link from "next/link";

import UnsubscribePanel from "@/src/components/newsletter/UnsubscribePanel";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";

/**
 * Leaving the Inner Circle.
 *
 * ## Nothing is removed by rendering this
 *
 * The page reads the token out of the URL and hands it to a button. It performs
 * no write of its own, because a link in an email is fetched by link scanners,
 * spam filters and prefetching mail clients as a matter of course — and every
 * one of those would otherwise unsubscribe somebody who never clicked. See
 * `src/actions/unsubscribe.ts`.
 *
 * ## Not indexed
 *
 * Every URL here carries somebody's token. `robots: noindex, nofollow` keeps
 * them out of search results, and `force-dynamic` keeps one visitor's token
 * from being cached into another visitor's page.
 *
 * ## Public by design
 *
 * `src/proxy.ts` protects only `/account` and `/admin`, so this route needs no
 * exemption. That is correct rather than incidental: most subscribers have no
 * account, and requiring a sign-in to leave a mailing list is how an
 * unsubscribe link becomes a spam complaint.
 */

export const dynamic = "force-dynamic";

const PATH = "/unsubscribe";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return {
    ...localeMetadata({
      locale: isLocale(locale) ? locale : "en",
      path: PATH,
      title: dict.unsubscribe.meta.title,
      description: dict.unsubscribe.meta.description,
    }),
    robots: { index: false, follow: false },
  };
}

function readToken(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
}

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  const token = readToken(query.token);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 py-24 sm:py-32">
      {token.length === 0 ? (
        // No token at all — the same wording as a token that matches nothing,
        // so neither case tells a prober anything the other does not.
        <div className="mx-auto max-w-xl text-center">
          <p className="font-heading text-[10px] uppercase tracking-[0.3em] text-gold/70">
            {dict.unsubscribe.eyebrow}
          </p>
          <h1 className="mt-6 font-heading text-2xl tracking-[0.08em] text-ivory sm:text-3xl">
            {dict.unsubscribe.invalidHeading}
          </h1>
          <p className="mt-6 text-[13px] leading-relaxed tracking-wide text-ivory/50">
            {dict.unsubscribe.invalidBody}
          </p>
        </div>
      ) : (
        <UnsubscribePanel token={token} copy={dict.unsubscribe} />
      )}

      <Link
        href={localizePath(activeLocale, "/")}
        className="mt-14 font-heading text-[10px] uppercase tracking-[0.25em] text-ivory/35 transition-colors duration-300 hover:text-gold"
      >
        {dict.unsubscribe.home}
      </Link>
    </main>
  );
}
