import Link from "next/link";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  countProductsMissingEmbedding,
  listAdminCollections,
  listAdminProducts,
} from "@/src/services/admin/catalog";
import { listAdminArticles } from "@/src/services/admin/journal";

/**
 * Dashboard index.
 *
 * Counts and three doors. `force-dynamic` because an editor must never be shown
 * a cached copy of a number they just changed — that is the whole reason a
 * dashboard exists beside a set of ISR pages.
 *
 * The embedding figure earns its place: a product with no vector is completely
 * invisible as a problem from the storefront (search still returns it, ranked
 * on words alone), so a number on this screen is the only thing that turns it
 * into something anyone notices.
 */

export const dynamic = "force-dynamic";

function Tile({
  label,
  value,
  href,
  note,
}: {
  label: string;
  value: number | string;
  href: string;
  note?: string;
}) {
  return (
    <Link
      href={href}
      className="block border border-border bg-ivory/2 p-8 transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-gold/30"
    >
      <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
        {label}
      </p>
      <p className="mt-4 font-heading text-4xl tracking-[0.1em] text-gold">{value}</p>
      {note ? <p className="mt-3 text-[11px] text-ivory/30">{note}</p> : null}
    </Link>
  );
}

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [collections, products, articles, missingEmbeddings] = await Promise.all([
    listAdminCollections(),
    listAdminProducts(),
    listAdminArticles(),
    countProductsMissingEmbedding(),
  ]);

  const live = products.filter((product) => !product.isArchived).length;
  const drafts = articles.filter((article) => !article.isPublished).length;

  return (
    <>
      <AdminPageHeader
        title="Boutique Desk"
        description="Everything the storefront reads lives in the database. Changes made here are live on the site within a reload — there is no build step and no CMS in between."
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <Tile
          label="Collections"
          value={collections.length}
          href={localizePath(activeLocale, "/admin/collections")}
        />
        <Tile
          label="Products"
          value={live}
          note={
            products.length - live > 0
              ? `${products.length - live} archived`
              : "All live"
          }
          href={localizePath(activeLocale, "/admin/products")}
        />
        <Tile
          label="Journal"
          value={articles.length}
          note={drafts > 0 ? `${drafts} unpublished` : "All published"}
          href={localizePath(activeLocale, "/admin/journal")}
        />
      </div>

      {missingEmbeddings > 0 ? (
        <div className="mt-8 border border-warning/30 bg-warning/5 p-6">
          <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-warning">
            Search vectors
          </p>
          <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-ivory/50">
            {missingEmbeddings} live product{missingEmbeddings === 1 ? " has" : "s have"} no
            embedding. Those products are still searchable by keyword, but not by
            meaning, and they will not appear in the &ldquo;you may also love&rdquo;
            rail. Run <code className="text-champagne">npm run embed</code> to fill
            them in.
          </p>
        </div>
      ) : null}
    </>
  );
}
