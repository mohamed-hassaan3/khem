import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import AdminSearch from "@/src/components/admin/AdminSearch";
import {
  AdminCell,
  AdminEmpty,
  AdminLinkButton,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import { matchesTerm, searchTerm } from "@/src/lib/admin/filter";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listAdminIngredients } from "@/src/services/admin/content";

/**
 * The raw materials.
 *
 * A list of its own rather than a section on `/admin/content`, because unlike
 * the timeline or the craft figures a material is a *record* — it has a slug, a
 * photograph, a list of provenance notes and a set of perfumes it appears in.
 * Editing one in a card beside four other tables would be a card the size of a
 * page.
 *
 * Searching happens in memory: `src/lib/admin/filter.ts` documents the trade,
 * and a house catalogues tens of materials, not thousands.
 */
export const dynamic = "force-dynamic";

export default async function AdminIngredientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const term = searchTerm(query);
  const all = await listAdminIngredients();

  const ingredients = all.filter((ingredient) =>
    matchesTerm(term, [
      ingredient.name,
      ingredient.name_ar,
      ingredient.latinName,
      ingredient.origin,
      ingredient.slug,
    ]),
  );

  const basePath = localizePath(activeLocale, "/admin/content/ingredients");
  const untranslated = all.filter((row) => row.name_ar === null).length;

  return (
    <>
      <Link
        href={localizePath(activeLocale, "/admin/content")}
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
      >
        <ArrowLeft size={13} strokeWidth={1.25} />
        All content
      </Link>

      <AdminPageHeader
        title="Ingredients"
        description="The materials behind the fragrances — shown on /ingredients, on the home rail, and on the detail page of every perfume they are printed on."
        action={
          <AdminLinkButton href={`${basePath}/new`}>
            <Plus size={13} strokeWidth={1.25} />
            Add material
          </AdminLinkButton>
        }
      />

      <AdminSearch placeholder="Search by name, binomial or origin" />

      {all.length > 0 ? (
        <p className="mb-5 text-[11px] tracking-wide text-ground-muted">
          {all.length} material{all.length === 1 ? "" : "s"}
          {untranslated > 0 ? ` · ${untranslated} with no Arabic name` : ""}
        </p>
      ) : null}

      {ingredients.length === 0 ? (
        <AdminEmpty
          message={
            term.length > 0
              ? "No materials match that search."
              : "No materials yet. The ingredients page stays empty until one is added."
          }
          action={
            term.length > 0 ? undefined : (
              <AdminLinkButton href={`${basePath}/new`}>
                Add the first material
              </AdminLinkButton>
            )
          }
        />
      ) : (
        <AdminTable
          headers={[
            "Material",
            "Origin",
            "Families",
            "Tier",
            "Used in",
            { label: "Edit", hidden: true },
          ]}
        >
          {ingredients.map((ingredient) => (
            <AdminRow key={ingredient.id}>
              <AdminCell>
                <span className="block tracking-wide">{ingredient.name}</span>
                <span className="mt-1 block text-[11px] italic text-ground-subtle">
                  {ingredient.latinName}
                </span>
                {ingredient.name_ar === null ? (
                  <span
                    title="No Arabic name — the Arabic page falls back to the English"
                    className="mt-2 inline-block border border-ground-border px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-muted"
                  >
                    No Arabic
                  </span>
                ) : null}
              </AdminCell>

              <AdminCell muted>{ingredient.origin}</AdminCell>

              <AdminCell muted>
                {ingredient.families.join(" · ")}
              </AdminCell>

              <AdminCell muted>{"$".repeat(ingredient.priceTier)}</AdminCell>

              <AdminCell muted>
                {ingredient.usedIn.length === 0
                  ? "—"
                  : `${ingredient.usedIn.length} perfume${ingredient.usedIn.length === 1 ? "" : "s"}`}
              </AdminCell>

              <AdminCell>
                <Link
                  href={`${basePath}/${ingredient.slug}`}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
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
