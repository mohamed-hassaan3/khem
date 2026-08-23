import type { LucideIcon } from "lucide-react";

import LocaleLink from "@/src/components/i18n/LocaleLink";

/**
 * The centred "nothing here yet" block on `/cart`.
 *
 * The icon is passed as a Lucide component rather than drawn inline (AGENTS.md
 * §6: Lucide, `strokeWidth` 1.25 — lighter here because the glyph is rendered
 * at 64px, where 1.25 reads as a heavy outline).
 *
 * The cart panel does not use it: at 400px this block's 64px glyph and 60vh
 * floor are a page-scale composition, so `<CartDrawer>` inlines a compact
 * version rather than growing props here to shrink it.
 */

export interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  body: string;
  cta: string;
  /** Locale-agnostic path; `<LocaleLink>` prefixes it. */
  href: string;
}

export default function EmptyState({
  icon: Icon,
  heading,
  body,
  cta,
  href,
}: EmptyStateProps) {
  return (
    <section className="flex min-h-[60vh] items-center justify-center px-4 md:px-6 py-14 md:py-24">
      <div className="max-w-md text-center">
        <Icon
          size={64}
          strokeWidth={0.8}
          aria-hidden="true"
          className="mx-auto mb-8 text-gold/30"
        />

        <h2 className="mb-4 font-heading text-2xl font-normal text-ivory sm:text-3xl">
          {heading}
        </h2>

        <p className="mb-6 md:mb-10 text-[13px] leading-loose text-ivory/40">{body}</p>

        <LocaleLink href={href} className="btn-luxury btn-luxury-fill">
          {cta}
        </LocaleLink>
      </div>
    </section>
  );
}
