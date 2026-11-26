"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import { localizePath, stripLocale } from "@/src/lib/i18n/config";
import { useLocale } from "@/src/providers/i18n-provider";

type LocaleLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/** Anything that is not an internal app path is passed through untouched. */
function isExternal(href: string): boolean {
  return !href.startsWith("/") || href.startsWith("//");
}

/**
 * The transition type that lets the page region cross-fade (`<ViewTransition>`
 * around `{children}` in the `[locale]` layout, `.khem-page-fade` in
 * `globals.css`). Only navigations that carry it animate — a filter change, a
 * `router.refresh()` after adding to the bag, the browser's back button or a
 * Suspense reveal carry none, so none of them blink.
 */
const PAGE_TRANSITION = ["khem-page"];

/** The pathname a link leads to, without its query or fragment. */
function pathOf(href: string): string {
  const end = href.search(/[?#]/);
  return end === -1 ? href : href.slice(0, end);
}

/**
 * `next/link` that keeps navigation inside the active locale tree.
 *
 * Internal hrefs are written locale-agnostically (`/heritage`) and prefixed at
 * render time, so no call site has to know which locale it is running under.
 * Under `ar` this yields `/ar/heritage`; under the default `en` the href is
 * unchanged.
 *
 * A link to a *different page* also asks for the page cross-fade. One to the
 * page already on screen (only the query or hash changes — a facet, a sort, an
 * anchor) does not: the content is the same place with different contents, and
 * fading the whole region for it would read as a reload.
 * prompts/motion-and-first-impression-stage-8.md.
 */
export default function LocaleLink({ href, transitionTypes, ...props }: LocaleLinkProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const external = isExternal(href);
  const resolved = external ? href : localizePath(locale, href);

  const samePage =
    external || stripLocale(pathOf(resolved)).path === stripLocale(pathname).path;

  return (
    <Link
      href={resolved}
      transitionTypes={transitionTypes ?? (samePage ? undefined : PAGE_TRANSITION)}
      {...props}
    />
  );
}
