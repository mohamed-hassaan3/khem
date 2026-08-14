"use client";

import { useConsent } from "@/src/providers/consent-provider";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * The footer's "Cookie Settings" trigger — the way back to a decision already
 * made, which a consent banner is not compliant without.
 *
 * Styled to match the legal links beside it exactly, so the row reads as four
 * peers rather than three links and a button. The class is passed in from
 * `Footer.tsx` rather than duplicated here, so the two cannot drift.
 *
 * A one-component client island: the Footer itself stays a Server Component.
 */
export default function CookieSettingsButton({
  className,
}: {
  className: string;
}) {
  const { open } = useConsent();
  const dict = useDictionary();

  return (
    <button type="button" onClick={open} className={className}>
      {dict.cookieConsent.settingsLink}
    </button>
  );
}
