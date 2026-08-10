import Image from "next/image";
import Link from "next/link";

import logo from "@/public/logo/logo-transparent.svg";
import { en } from "@/src/lib/i18n/dictionaries/en";
import { ar } from "@/src/lib/i18n/dictionaries/ar";

/**
 * 404 page — bilingual by necessity.
 *
 * `not-found.tsx` cannot export `metadata`; the title comes from the root
 * layout's template.
 *
 * This is the root `not-found`, since the root layout lives at
 * `app/[locale]/layout.tsx`. Unmatched paths reach it through the catch-all in
 * `app/[locale]/[...rest]/page.tsx`.
 *
 * Three constraints, each verified against a production build, force the shape
 * of this file:
 *
 * 1. **It must be a Server Component.** Next renders the not-found boundary
 *    inside its own error shell, where Client Components are not
 *    server-rendered — a `"use client"` version silently fell through to
 *    Next's built-in 404. So the locale cannot come from `I18nProvider`.
 * 2. **It receives no route params**, so the locale cannot come from
 *    `params.locale` either.
 * 3. **It must not read `headers()`.** Next includes `not-found` in every
 *    route's render tree, so a request-time API here opts the *entire* site
 *    out of static generation — all 24 prerendered pages became `ƒ`.
 *
 * With no way to resolve one locale, the page addresses both: each language
 * gets its own correctly-directioned block, and both home links are offered.
 * That is honest for a two-locale site and costs a visitor nothing, whereas
 * guessing English would strand Arabic visitors on a page they cannot read.
 */
export default function NotFound() {
  return (
    <div className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_color-mix(in_srgb,var(--color-gold)_4%,transparent)_0%,_transparent_60%)]"
        aria-hidden="true"
      />

      {/* Decorative rings */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-100 w-100 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/5 sm:h-175 sm:w-175" />
        <div className="absolute left-1/2 top-1/2 h-150 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/3 sm:h-250 sm:w-250" />
      </div>

      <div className="relative z-10">
        <div className="mb-10 flex justify-center opacity-40">
          <Image src={logo} width={40} height={40} alt="" aria-hidden="true" />
        </div>

        <p
          className="font-heading text-8xl font-bold leading-none text-gold/12 sm:text-9xl lg:text-[160px]"
          aria-hidden="true"
        >
          404
        </p>

        <div lang="en" dir="ltr">
          <h1 className="mb-5 font-heading text-2xl font-normal tracking-widest text-ivory sm:text-3xl md:text-4xl">
            {en.notFound.heading}
          </h1>
          <p className="mx-auto max-w-100 text-sm leading-loose text-ivory/40">
            {en.notFound.body}
          </p>
        </div>

        <div className="gold-line mx-auto my-8" />

        <div lang="ar" dir="rtl">
          <p className="mb-4 font-heading text-xl font-normal text-ivory sm:text-2xl">
            {ar.notFound.heading}
          </p>
          <p className="mx-auto max-w-100 text-sm leading-loose text-ivory/40">
            {ar.notFound.body}
          </p>
        </div>

        <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
          {/*
            Plain `next/link` with explicit prefixes, not `<LocaleLink>`: that
            reads the locale from client context, which is not available when
            this renders. One home link per locale instead.
          */}
          <Link href="/" className="btn-luxury btn-luxury-fill" hrefLang="en">
            {en.notFound.primary}
          </Link>
          <Link
            href="/ar"
            className="btn-luxury tracking-normal"
            hrefLang="ar"
            lang="ar"
          >
            {ar.notFound.primary}
          </Link>
        </div>
      </div>
    </div>
  );
}
