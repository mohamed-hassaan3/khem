import Link from "next/link";
import { Plus } from "lucide-react";

import {
  AdminCell,
  AdminEmpty,
  AdminLinkButton,
  AdminPageHeader,
  AdminRow,
  AdminStatus,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import AdminSearch from "@/src/components/admin/AdminSearch";
import StatusToggle from "@/src/components/admin/StatusToggle";
import { matchesTerm, searchTerm } from "@/src/lib/admin/filter";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listAdminProducts } from "@/src/services/admin/catalog";

export const dynamic = "force-dynamic";

/**
 * Piastres as pounds, for a working list.
 *
 * Not `formatPrice()` from `src/lib/format.ts`: that converts into the
 * visitor's display currency, which is the last thing this screen wants. An
 * editor is checking what they stored, and what they stored is EGP.
 */
function egp(priceInCents: number): string {
  return `EGP ${(priceInCents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function AdminProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const term = searchTerm(query);
  const all = await listAdminProducts();

  // Name, slug, SKU and collection — an editor hunting for a row types whichever
  // of those they happen to remember, and should not have to know which one the
  // box searches.
  const products = all.filter((product) =>
    matchesTerm(term, [
      product.name,
      product.slug,
      product.sku,
      product.collectionSlug,
    ]),
  );

  return (
    <>
      <AdminPageHeader
        title="Products"
        description="Archived products vanish from every storefront surface but keep their row, because order history will point at them."
        action={
          <AdminLinkButton href={localizePath(activeLocale, "/admin/products/new")}>
            <Plus size={13} strokeWidth={1.25} />
            New product
          </AdminLinkButton>
        }
      />

      <AdminSearch placeholder="Search by name, slug, SKU or collection" />

      {products.length === 0 ? (
        <AdminEmpty
          message={
            term.length > 0
              ? `Nothing matches “${term}”.`
              : "No products yet."
          }
          action={
            term.length > 0 ? undefined : (
              <AdminLinkButton href={localizePath(activeLocale, "/admin/products/new")}>
                Create the first product
              </AdminLinkButton>
            )
          }
        />
      ) : (
        <AdminTable
          headers={[
            "Name",
            "Collection",
            "SKU",
            "Price",
            "Stock",
            "Status",
            { label: "Availability action", hidden: true },
            { label: "Edit", hidden: true },
          ]}
        >
          {products.map((product) => (
            <AdminRow key={product.slug}>
              <AdminCell>
                <span className="block">{product.name}</span>
                <span className="mt-1 block text-[10px] tracking-wide text-ivory/25">
                  {product.slug}
                </span>
              </AdminCell>
              <AdminCell muted>{product.collectionSlug}</AdminCell>
              <AdminCell muted>{product.sku}</AdminCell>
              <AdminCell>{egp(product.priceInCents)}</AdminCell>
              <AdminCell muted={product.inventory > 0}>
                {product.inventory === 0 ? (
                  <span className="text-danger">Out of stock</span>
                ) : (
                  product.inventory
                )}
              </AdminCell>
              <AdminCell>
                <AdminStatus live={!product.isArchived} />
              </AdminCell>
              <AdminCell>
                <StatusToggle
                  kind="product-archive"
                  slug={product.slug}
                  isOn={!product.isArchived}
                  onLabel="Archive"
                  offLabel="Restore"
                  confirmLabel="Confirm"
                />
              </AdminCell>
              <AdminCell>
                <Link
                  href={localizePath(activeLocale, `/admin/products/${product.slug}`)}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-gold/70 transition-colors duration-300 hover:text-gold"
                >
                  Edit
                </Link>
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </>
  );
}
