import { ChevronRight } from "lucide-react";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { ltrIsland } from "@/src/lib/i18n/rtl";

/**
 * Product detail breadcrumb — Server Component.
 *
 * Home → Collections → {collection} → {product}. The separator is a chevron
 * rather than the literal "/" the original design used: a slash does not mirror
 * with `dir`, so on the Arabic tree it points the trail backwards.
 */

export interface ProductBreadcrumbProps {
  locale: Locale;
  /** `null` when the product's collection could not be resolved. */
  collection: { name: string; slug: string } | null;
  productName: string;
}

export default async function ProductBreadcrumb({
  locale,
  collection,
  productName,
}: ProductBreadcrumbProps) {
  const dict = await getDictionary(locale);
  // Collection and product names come from the database — English in both trees.
  const island = ltrIsland(locale);

  return (
    <div className="border-b border-ground-border px-4 py-6 md:px-20">
      <nav
        aria-label={dict.product.collections}
        className="mx-auto flex max-w-350 flex-wrap items-center gap-2 text-[11px] tracking-wide"
      >
        <BreadcrumbLink href="/">{dict.product.home}</BreadcrumbLink>
        <Separator />

        <BreadcrumbLink href="/collections">
          {dict.product.collections}
        </BreadcrumbLink>

        {collection ? (
          <>
            <Separator />
            <BreadcrumbLink href={`/collections/${collection.slug}`}>
              {/* Category collections carry an Arabic name; the house ranges
                  fall back to their Latin one. */}
              <span dir="auto">{collection.name}</span>
            </BreadcrumbLink>
          </>
        ) : null}

        <Separator />
        <span aria-current="page" className="text-ground-accent/70" {...island}>
          {productName}
        </span>
      </nav>
    </div>
  );
}

function BreadcrumbLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <LocaleLink
      href={href}
      className="text-ground-muted no-underline transition-colors duration-300 ease-out hover:text-ground-muted focus-visible:text-ground-accent focus-visible:outline-none"
    >
      {children}
    </LocaleLink>
  );
}

function Separator() {
  return (
    <ChevronRight
      size={12}
      strokeWidth={1.25}
      aria-hidden="true"
      className="shrink-0 text-ground-muted/60 rtl:rotate-180"
    />
  );
}
