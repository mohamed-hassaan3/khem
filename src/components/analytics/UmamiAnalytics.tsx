"use client";

import Script from "next/script";

import {
  BEFORE_SEND_HANDLER,
  UMAMI_DOMAIN,
  UMAMI_SCRIPT_SRC,
  UMAMI_WEBSITE_ID,
  beforeSend,
  shouldLoadUmami,
} from "@/src/lib/analytics/umami";

/**
 * The Umami tracker — cookieless visitor counting, on every page view.
 *
 * **Not consent-gated, on purpose** (`prompts/umami-count-every-visitor.md`).
 * Umami sets no cookies and writes nothing to the visitor's device, so the
 * cookie banner has nothing to say about it, and the published Cookie Policy
 * states that it is not affected by the banner choice. It therefore does not
 * read `useConsent()`, and `scripts/umami-analytics.test.ts` fails if it ever
 * starts to.
 *
 * What protects the visitor is unchanged and lives in the attributes below and
 * in `beforeSend` (`src/lib/analytics/umami.ts`):
 *
 * - excluded paths (`/admin`, `/account`, `/sign-in`, `/sign-up`,
 *   `/unsubscribe`) are never sent, nor reported as a referrer;
 * - query strings and hashes are stripped by the tracker before sending;
 * - only `khemperfumes.com` records — never localhost or a preview host;
 * - a browser sending Do-Not-Track is not counted at all;
 * - no `identify()`: Umami never learns who anyone is.
 *
 * `next/script` with `afterInteractive` keeps the ~2 KB tracker off the
 * critical path, and this component uses no dynamic API, so the `[locale]`
 * layout stays prerendered.
 */

/*
 * Registered when this module is evaluated in the browser — before hydration,
 * and so before `next/script` injects the tag — so the tracker finds the
 * handler on its very first send. `data-before-send` names it.
 */
if (typeof window !== "undefined") {
  window[BEFORE_SEND_HANDLER] = beforeSend;
}

export default function UmamiAnalytics() {
  if (!shouldLoadUmami()) return null;

  return (
    <Script
      id="khem-umami"
      src={UMAMI_SCRIPT_SRC}
      strategy="afterInteractive"
      data-website-id={UMAMI_WEBSITE_ID}
      data-domains={UMAMI_DOMAIN}
      data-before-send={BEFORE_SEND_HANDLER}
      data-exclude-search="true"
      data-exclude-hash="true"
      data-do-not-track="true"
    />
  );
}
