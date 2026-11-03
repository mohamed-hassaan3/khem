"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import type { SignupBenefit } from "@/src/types/benefits";
import type { MarketingSettings } from "@/src/types/marketing";

/**
 * The cookie banner and the offer popup, loaded after the page is interactive.
 *
 * Both are modal chrome that nobody needs in the first second, but as static
 * imports of the root layout they ship in the first-load JS bundle and hydrate
 * with the page — which is main-thread time (TBT) spent before the visitor can
 * do anything. `ssr: false` keeps them out of the server HTML as well; both
 * are `fixed`, so mounting them late cannot shift layout.
 *
 * `<OfferPopup>` already waits for the consent banner to be answered, so
 * deferring both preserves that ordering: the banner mounts first.
 */
const CookieConsent = dynamic(
  () => import("@/src/components/consent/CookieConsent"),
  { ssr: false },
);
const OfferPopup = dynamic(
  () => import("@/src/components/marketing/OfferPopup"),
  { ssr: false },
);

/** Idle, with a timeout so a busy main thread cannot defer it for ever. */
function whenIdle(cb: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(cb, { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, 2000);
  return () => window.clearTimeout(id);
}

export default function DeferredOverlays({
  offerPopup,
}: {
  /** `null` when the popup is switched off in the admin. */
  offerPopup: { settings: MarketingSettings; benefit: SignupBenefit } | null;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => whenIdle(() => setReady(true)), []);

  if (!ready) return null;

  return (
    <>
      <CookieConsent />
      {offerPopup ? (
        <OfferPopup
          settings={offerPopup.settings}
          benefit={offerPopup.benefit}
        />
      ) : null}
    </>
  );
}
