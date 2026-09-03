import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import NavigationEditor from "@/src/components/admin/NavigationEditor";
import { NAV_PAGES, navPageCopy, type NavPageKey } from "@/src/constants/navigation-pages";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import {
  listAdminCategories,
  listAdminCollections,
  listAdminNavLinks,
} from "@/src/services/admin/catalog";

export const dynamic = "force-dynamic";

/**
 * The menu.
 *
 * Everything an editor needs to put a newly created collection in front of a
 * visitor, and the last step of the flow the rest of this section sets up:
 * category → collection → products → **menu**.
 *
 * The targets are read here rather than in the editor because they are three
 * short lists the server already has, and because a client component has no
 * business holding a Supabase client.
 */
export default async function AdminNavigationPage() {
  const [links, categories, collections, dict] = await Promise.all([
    listAdminNavLinks(),
    listAdminCategories(),
    listAdminCollections(),
    // The dashboard is written in English; the storefront resolves each label in
    // the reader's own language at render time.
    getDictionary("en"),
  ]);

  const targets = {
    categories: categories.map((category) => ({
      value: category.slug,
      label: category.isEnabled ? category.name : `${category.name} (withdrawn)`,
    })),
    collections: collections.map((collection) => ({
      value: collection.slug,
      label: collection.name,
    })),
    pages: (Object.keys(NAV_PAGES) as NavPageKey[]).map((key) => ({
      value: key,
      label: `${navPageCopy(dict, key).label} — ${NAV_PAGES[key].path}`,
    })),
    groups: (
      Object.keys(dict.nav.collectionGroups) as (keyof typeof dict.nav.collectionGroups)[]
    ).map((key) => ({ value: key, label: dict.nav.collectionGroups[key] })),
    /*
     * What each category prints beneath itself without being listed. Grouped
     * here from the one list already in hand, in the same `sortOrder` the
     * storefront reads.
     */
    collectionsByCategory: collections.reduce<
      Record<string, { slug: string; name: string }[]>
    >((grouped, collection) => {
      const siblings = grouped[collection.categorySlug] ?? [];
      siblings.push({ slug: collection.slug, name: collection.name });
      grouped[collection.categorySlug] = siblings;
      return grouped;
    }, {}),
  };

  return (
    <>
      <AdminPageHeader
        title="Navigation"
        description="What the header menu and the footer offer, in the order they print it. An entry pointing at a category is a heading over that shelf: every collection assigned to the category appears beneath it on its own, so a new collection needs nothing here. Add a row only to give one its own wording, its own place in the order, or a description. An entry points at a category, a collection, or a page KHEM ships — never at a typed address, so a menu link cannot lead nowhere."
      />

      <NavigationEditor links={links} targets={targets} />
    </>
  );
}
