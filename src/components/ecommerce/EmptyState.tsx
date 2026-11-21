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
 *
 * ## `compact`
 *
 * For an empty *section* inside a page rather than an empty page — the account
 * panels. The default is a page-scale composition with a 60vh floor; inside
 * `/account` that made one empty list taller than a phone, and the Vouchers
 * panel can show two in a row. Compact drops the floor and steps the glyph,
 * heading, and spacing down. The default is untouched, so every storefront use
 * renders exactly as before.
 */

export interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  body: string;
  cta: string;
  /** Locale-agnostic path; `<LocaleLink>` prefixes it. */
  href: string;
  /** Section-scale rather than page-scale. See the note above. */
  compact?: boolean;
}

export default function EmptyState({
  icon: Icon,
  heading,
  body,
  cta,
  href,
  compact = false,
}: EmptyStateProps) {
  if (compact) {
    return (
      <section className="border border-ground-border bg-stone px-5 py-8 text-center sm:px-8 sm:py-12">
        <div className="mx-auto max-w-md">
          <Icon
            size={40}
            strokeWidth={0.9}
            aria-hidden="true"
            className="mx-auto mb-4 text-ground-accent/35"
          />

          <h2 className="mb-2 font-heading text-xl font-normal text-ground sm:text-2xl">
            {heading}
          </h2>

          <p className="mb-5 text-[12px] leading-relaxed text-ground-muted sm:mb-7 sm:text-[13px] sm:leading-loose">
            {body}
          </p>

          {/* Full-size button: `.btn-sm` drops below the 44px touch target. */}
          <LocaleLink href={href} className="btn btn-primary">
            {cta}
          </LocaleLink>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-[60vh] items-center justify-center px-4 md:px-6 py-14 md:py-24">
      <div className="max-w-md text-center">
        <Icon
          size={64}
          strokeWidth={0.8}
          aria-hidden="true"
          className="mx-auto mb-8 text-ground-accent/30"
        />

        <h2 className="mb-4 font-heading text-2xl font-normal text-ground sm:text-3xl">
          {heading}
        </h2>

        <p className="mb-6 md:mb-10 text-[13px] leading-loose text-ground-muted">{body}</p>

        <LocaleLink href={href} className="btn btn-primary">
          {cta}
        </LocaleLink>
      </div>
    </section>
  );
}
