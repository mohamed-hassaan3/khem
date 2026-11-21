import Image from "next/image";

import type { Locale } from "@/src/lib/i18n/config";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { Viewer } from "@/src/types/account";

/**
 * Who is signed in — avatar, name, email.
 *
 * A Server Component: every value comes from the Clerk session read on the
 * server, so nothing about the customer is serialized into the client bundle
 * to render three lines of text.
 *
 * Two sizes of one block:
 *  - `rail` — the desktop rail's head, a 44px avatar beside the name.
 *  - `hero` — the Profile panel's title, a 56px avatar beside an `<h1>`.
 *
 * The avatar without a photograph is the house's own mark: an obsidian disc
 * with the initial in gold, the same treatment as the membership card.
 *
 * The email is an LTR island. An address is a Latin string with meaningful
 * order (`name@host`); left to an RTL context the bidi algorithm moves its
 * punctuation. `rtl:text-right` keeps the island at the reading start.
 */
export interface AccountIdentityProps {
  viewer: Viewer;
  locale: Locale;
  variant?: "rail" | "hero";
  /** `hero` only: the small label above the name. */
  eyebrow?: string;
}

export default function AccountIdentity({
  viewer,
  locale,
  variant = "rail",
  eyebrow,
}: AccountIdentityProps) {
  const hero = variant === "hero";
  const size = hero ? 56 : 44;
  const name = viewer.fullName ?? viewer.primaryEmail ?? "";
  const NameTag = hero ? "h1" : "p";

  return (
    <div className="flex min-w-0 items-center gap-3.5">
      {viewer.imageUrl ? (
        <Image
          src={viewer.imageUrl}
          alt=""
          width={size}
          height={size}
          className="shrink-0 rounded-full border border-gold/50 object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{ width: size, height: size }}
          className={[
            "grid shrink-0 place-items-center rounded-full border border-gold/50 bg-background font-heading text-gold-soft",
            hero ? "text-xl" : "text-base",
          ].join(" ")}
        >
          {viewer.initial}
        </span>
      )}

      <div className="min-w-0 flex-1">
        {hero && eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}

        <NameTag
          {...(viewer.fullName ? {} : ltrIsland(locale))}
          className={[
            "truncate font-normal text-ground rtl:text-right",
            // An email in Cinzel reads as all capitals; an email-only account
            // gets its address in the body face instead.
            viewer.fullName
              ? hero
                ? "font-heading text-[22px] leading-tight"
                : "font-heading text-[14px]"
              : // `font-body` explicitly: the base layer sets every h1 in
                // the heading face, so leaving it unset is not enough.
                hero
                ? "font-body text-[17px] leading-tight"
                : "font-body text-[13px]",
          ].join(" ")}
        >
          {name}
        </NameTag>

        {viewer.fullName && viewer.primaryEmail ? (
          <p
            {...ltrIsland(locale)}
            className="mt-0.5 truncate text-[12px] text-ground-muted rtl:text-right"
          >
            {viewer.primaryEmail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
