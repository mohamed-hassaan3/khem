import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import IngredientForm from "@/src/components/admin/IngredientForm";
import IngredientProductsPanel from "@/src/components/admin/IngredientProductsPanel";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listAdminProducts } from "@/src/services/admin/catalog";
import { getAdminIngredient } from "@/src/services/admin/content";

/**
 * One material.
 *
 * Two independent saves: the record itself, and the set of perfumes it is
 * printed on. They are separate because they fail separately — a typo in the
 * description should not roll back a re-linking, and vice versa.
 */
export const dynamic = "force-dynamic";

export default async function EditIngredientPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [ingredient, products] = await Promise.all([
    getAdminIngredient(decodeURIComponent(slug)),
    listAdminProducts(),
  ]);

  if (!ingredient) notFound();

  // Archived products are excluded: printing a material on something nobody can
  // buy would put a dead link on the ingredients page.
  const options = products
    .filter((product) => !product.isArchived)
    .map((product) => ({
      slug: product.slug,
      name: product.name,
      collectionSlug: product.collectionSlug,
    }));

  return (
    <>
      <Link
        href={localizePath(activeLocale, "/admin/content/ingredients")}
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
      >
        <ArrowLeft size={13} strokeWidth={1.25} />
        All ingredients
      </Link>

      <AdminPageHeader
        title={ingredient.name}
        description={`${ingredient.latinName} · ${ingredient.origin}`}
      />

      <IngredientForm ingredient={ingredient} locale={activeLocale} />

      <section className="mt-12 max-w-3xl space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Printed on
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed text-ground-muted">
            The perfumes whose detail page lists this material under Key
            Ingredients. Saved separately from the record above.
          </p>
        </div>

        <IngredientProductsPanel
          ingredientId={ingredient.id}
          products={options}
          selected={ingredient.usedIn.map((usage) => usage.productSlug)}
        />
      </section>
    </>
  );
}
