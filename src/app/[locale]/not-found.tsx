"use client";

import Image from "next/image";

import logo from "@/public/logo/logo-transparent.webp";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * 404 page.
 *
 * `not-found.tsx` cannot export `metadata` — the title comes from the root
 * layout's template.
 *
 * ## Why this is a Client Component
 *
 * Next gives `not-found.tsx` no `params`, so a Server Component here has no
 * way to learn which locale it is answering for — which is how this page came
 * to print English at an Arabic visitor. It does, however, render *inside*
 * `app/[locale]/layout.tsx`, and that layout mounts `<I18nProvider>` around its
 * children. So the locale and its dictionary are already in scope through
 * context: `useDictionary()` reads them without a single prop, a header, or a
 * change to `src/proxy.ts`.
 *
 * `<LocaleLink>` matters here for the same reason. Plain `next/link` would have
 * sent a visitor reading Arabic to the English home page, which is the same
 * defect wearing different clothes.
 *
 * The height is `100vh` minus the 5rem Nav rather than `100vh` plus 5rem of
 * padding, so the page fills the viewport instead of overflowing it.
 */
export default function NotFound() {
  const dict = useDictionary();

  return (
    <div className="ground-ivory relative flex min-h-[calc(100svh-var(--header-h))] items-center justify-center overflow-hidden px-6 text-center">
      {/*
        The gold radial wash is gone with the ground that carried it. A 4% gold
        bloom is a light source, and it only reads as one against near-black;
        on ivory it is a faint stain across the middle of the page.
      */}

      {/* Decorative rings */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-100 w-100 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/8 sm:h-175 sm:w-175" />
        <div className="absolute left-1/2 top-1/2 h-150 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/5 sm:h-250 sm:w-250" />
      </div>

      <div className="relative z-10">
        <div className="mb-6 md:mb-10 flex justify-center opacity-60">
          <Image src={logo} width={40} height={40} alt="" aria-hidden="true" />
        </div>

        {/* Western digits in both trees: the numeral is the universal part of
            a 404, and it is `aria-hidden` chrome rather than a sentence. */}
        <p
          className="font-heading text-8xl font-semibold leading-none text-ink/10 sm:text-9xl lg:text-[160px]"
          aria-hidden="true"
        >
          404
        </p>

        <h1 className="mb-5 font-heading text-2xl font-normal tracking-widest text-ground sm:text-3xl md:text-4xl">
          {dict.notFound.heading}
        </h1>

        <div className="gold-line mx-auto mb-7" />

        <p className="mx-auto mb-8 md:mb-12 max-w-100 text-sm leading-loose text-ground-muted">
          {dict.notFound.body}
        </p>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <LocaleLink href="/" className="btn btn-primary">
            {dict.notFound.primary}
          </LocaleLink>
          <LocaleLink href="/collections" className="btn btn-outline">
            {dict.notFound.secondary}
          </LocaleLink>
        </div>
      </div>
    </div>
  );
}
