import Image from "next/image";

import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { Locale } from "@/src/lib/i18n/config";
import type { Viewer } from "@/src/types/account";

/**
 * Who is signed in — avatar, name, email.
 *
 * A Server Component: every value comes from the Clerk session read on the
 * server, so nothing about the customer is serialized into the client bundle
 * to render three lines of text.
 *
 * The email is wrapped in an LTR island. An address is a Latin string with
 * meaningful order (`name@host`), and left to an RTL context the bidi
 * algorithm moves its punctuation — the same treatment every English catalog
 * record gets in this codebase.
 */

export interface AccountIdentityProps {
  viewer: Viewer;
  locale: Locale;
}

export default function AccountIdentity({
  viewer,
  locale,
}: AccountIdentityProps) {
  return (
    <div className="border-b border-ground-border px-9 pb-9">
      {viewer.imageUrl ? (
        <Image
          src={viewer.imageUrl}
          alt=""
          width={56}
          height={56}
          className="mb-4 h-14 w-14 rounded-full border border-ground-accent/30 object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="mb-4 grid h-14 w-14 place-items-center rounded-full border border-ground-accent/30 bg-gold/15"
        >
          <span className="font-heading text-lg font-semibold text-ground-accent">
            {viewer.initial}
          </span>
        </div>
      )}

      {viewer.fullName ? (
        <p className="mb-1 font-heading text-[15px] font-normal text-ground">
          {viewer.fullName}
        </p>
      ) : null}

      {viewer.primaryEmail ? (
        <p
          {...ltrIsland(locale)}
          className="text-[11px] tracking-[0.05em] text-ground-muted"
        >
          {viewer.primaryEmail}
        </p>
      ) : null}
    </div>
  );
}
