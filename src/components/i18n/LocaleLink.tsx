"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { localizePath } from "@/src/lib/i18n/config";
import { useLocale } from "@/src/providers/i18n-provider";

type LocaleLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/** Anything that is not an internal app path is passed through untouched. */
function isExternal(href: string): boolean {
  return !href.startsWith("/") || href.startsWith("//");
}

/**
 * `next/link` that keeps navigation inside the active locale tree.
 *
 * Internal hrefs are written locale-agnostically (`/heritage`) and prefixed at
 * render time, so no call site has to know which locale it is running under.
 * Under `ar` this yields `/ar/heritage`; under the default `en` the href is
 * unchanged.
 */
export default function LocaleLink({ href, ...props }: LocaleLinkProps) {
  const locale = useLocale();
  const resolved = isExternal(href) ? href : localizePath(locale, href);

  return <Link href={resolved} {...props} />;
}
