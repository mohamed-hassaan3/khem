import { ChevronRight, Mail, MapPin, MessageCircle, type LucideIcon } from "lucide-react";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import type { SavedAddress } from "@/src/types/account";

/**
 * "At a glance" — the two settings customers check most, one tap from Home:
 * where parcels go, and whether the house writes to them. Then the door to the
 * house itself for an order question.
 *
 * Phones: hairline rows. Desktop (`lg`): three cards in a row, the layout the
 * desktop overview ends on.
 */
function Row({
  href,
  icon: Icon,
  title,
  detail,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <LocaleLink
      href={href}
      className="acct-card group flex min-h-14 items-center gap-3 border-t border-ground-border py-3 text-ground no-underline lg:rounded-lg lg:border lg:bg-stone lg:px-5 lg:py-4"
    >
      <Icon size={18} strokeWidth={1.25} aria-hidden="true" className="shrink-0 text-ground-accent" />
      <span className="min-w-0 flex-1">
        <span dir="auto" className="block truncate text-[13px]">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-ground-muted rtl:text-[12px]">{detail}</span>
      </span>
      <ChevronRight
        size={16}
        strokeWidth={1.25}
        aria-hidden="true"
        className="shrink-0 text-ground-muted transition-transform duration-500 ease-luxury-bezier group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
      />
    </LocaleLink>
  );
}

export default function GlanceRows({
  address,
  marketingOptIn,
  dict,
}: {
  address: SavedAddress | null;
  marketingOptIn: boolean;
  dict: Dictionary["account"]["hub"];
}) {
  return (
    <div className="grid border-b border-ground-border lg:grid-cols-3 lg:gap-5 lg:border-b-0">
      <Row
        href={`${ACCOUNT_PATHS.profile}#addresses`}
        icon={MapPin}
        title={address ? `${address.label} · ${address.city}` : dict.addAddress}
        detail={address ? dict.defaultAddress : dict.noAddress}
      />
      <Row
        href={`${ACCOUNT_PATHS.profile}#preferences`}
        icon={Mail}
        title={dict.letters}
        detail={marketingOptIn ? dict.lettersOn : dict.lettersOff}
      />
      <Row href="/contact" icon={MessageCircle} title={dict.help} detail={dict.helpCta} />
    </div>
  );
}
