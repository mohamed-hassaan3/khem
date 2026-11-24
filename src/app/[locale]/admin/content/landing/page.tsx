import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import { ChevronDown } from "lucide-react";
import ContentBackLink from "@/src/components/admin/ContentBackLink";
import ContentRowsEditor from "@/src/components/admin/ContentRowsEditor";
import HeroForm from "@/src/components/admin/HeroForm";
import LandingSectionsEditor from "@/src/components/admin/LandingSectionsEditor";
import NewArrivalForm from "@/src/components/admin/NewArrivalForm";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  createCraftPillar,
  deleteCraftPillar,
  updateCraftPillar,
} from "@/src/actions/admin/content";
import {
  getAdminHero,
  listAdminCraftPillars,
} from "@/src/services/admin/content";
import { getLandingSections } from "@/src/services/content";
import { getAdminSettings } from "@/src/services/admin/settings";
import { listAdminProducts } from "@/src/services/admin/catalog";
import { requireAdmin } from "@/src/lib/admin/auth";

/**
 * The home page, section by section.
 *
 * ## The map is part of the screen, on purpose
 *
 * Most of the landing page is assembled from records managed elsewhere in this
 * dashboard — the collections rail from Collections, the two product bands from
 * Products and Settings, the materials from Ingredients, the reading list from
 * Journal. An editor sent here to "change the home page" needs to know that
 * before they go looking for a field that does not exist, so the section list
 * below says where each band comes from rather than pretending this screen owns
 * all of it.
 *
 * ## And it says what is not editable yet
 *
 * The **hero** used to be on that list and no longer is: it has its own table
 * (`supabase/sql/0037_hero.sql`) and its editor is on this screen. Everything
 * else below still applies.
 *
 * The headings, eyebrows and standfirsts between those bands live in
 * `src/lib/i18n/dictionaries/{en,ar}.ts` — roughly 3,500 lines of typed,
 * interpolated, RTL-aware copy, together with every page's SEO metadata. Moving
 * that into tables is a project of its own and was deliberately left out of this
 * one. Saying so here is the honest version; a screen with empty boxes that
 * silently fail to publish would not be.
 */
export const dynamic = "force-dynamic";


export default async function AdminLandingContentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // The layout's gate does not cover a page on client navigation — see requireAdmin().
  await requireAdmin();

  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [hero, pillars, sections, settings, products] = await Promise.all([
    getAdminHero(),
    listAdminCraftPillars(),
    getLandingSections(),
    getAdminSettings(),
    listAdminProducts(),
  ]);

  // Archived products are excluded: featuring one would put a full-bleed band on
  // the home page for something nobody can buy.
  const featurable = products
    .filter((product: { isArchived: boolean }) => !product.isArchived)
    .map((product: { slug: string; name: string }) => ({
      slug: product.slug,
      name: product.name,
    }));

  // The band whose settings this screen owns.
  const featured = sections.find(
    (section: { key: string }) => section.key === "featured",
  );

  return (
    <>
      <ContentBackLink
        href={localizePath(activeLocale, "/admin/content")}
        label="Content"
      />

      <AdminPageHeader
        title="Home page"
        description="The home page, in the order it is read. Most bands are assembled from records kept elsewhere in the dashboard — the list below says which, so nothing is edited twice."
      />

      <details open className="group rounded-lg border border-ground-border bg-stone/60 [&+details]:mt-3">
        <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
          <h2 className="font-heading text-[17px] font-normal text-ground">
            Sections
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
            Move a band to change where it falls on the page, or hide it to take
            it off entirely. A hidden band costs no query. The hero stays first
            because it decides the header’s colour over the first screen.
          </p>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
            Copy marked code-owned — headings, standfirsts and page metadata —
            is not in the database yet and still needs a developer to change.
          </p>
          </div>
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className="mt-1 shrink-0 text-ground-subtle transition-transform duration-300 group-open:rotate-180" />
        </summary>
        <div className="space-y-5 border-t border-ground-border px-4 py-5">

        <LandingSectionsEditor sections={sections} />
        </div>
      </details>

      <details className="group rounded-lg border border-ground-border bg-stone/60 [&+details]:mt-3">
        <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
          <h2 className="font-heading text-[17px] font-normal text-ground">
            New Arrival
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
            Everything this band shows, in one place — which product it features,
            what fills its backdrop, and optionally its own title, paragraph and
            button. Leave an override empty to use the product’s own.
          </p>
          </div>
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className="mt-1 shrink-0 text-ground-subtle transition-transform duration-300 group-open:rotate-180" />
        </summary>
        <div className="space-y-5 border-t border-ground-border px-4 py-5">

        <NewArrivalForm
          settings={featured?.settings ?? {}}
          featuredProductSlug={settings?.featuredProductSlug ?? null}
          products={featurable}
        />
        </div>
      </details>

      <details className="group rounded-lg border border-ground-border bg-stone/60 [&+details]:mt-3">
        <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
          <h2 className="font-heading text-[17px] font-normal text-ground">
            Hero
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
            The first screen of the home page. Configure images or a film here;
            with neither, the page opens on the typographic composition it has
            always used.
          </p>
          </div>
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className="mt-1 shrink-0 text-ground-subtle transition-transform duration-300 group-open:rotate-180" />
        </summary>
        <div className="space-y-5 border-t border-ground-border px-4 py-5">

        {hero ? (
          <HeroForm hero={hero} />
        ) : (
          <p className="border border-ground-border px-5 py-4 text-[12px] leading-relaxed text-ground-muted">
            The hero settings row could not be read. Apply the database
            migrations (<code>npm run db:migrate</code>) and reload.
          </p>
        )}
        </div>
      </details>

      <details className="group rounded-lg border border-ground-border bg-stone/60 [&+details]:mt-3">
        <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
          <h2 className="font-heading text-[17px] font-normal text-ground">
            Craft pillars
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
            The four-item summary on the home page. The ordinal has no Arabic
            field — &ldquo;01&rdquo; is written in Western digits in both trees.
          </p>
          </div>
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className="mt-1 shrink-0 text-ground-subtle transition-transform duration-300 group-open:rotate-180" />
        </summary>
        <div className="space-y-5 border-t border-ground-border px-4 py-5">

        <ContentRowsEditor
          rows={pillars}
          headingField="title"
          entityLabel="pillar"
          emptyMessage="No craft pillars. The home page hides the section until one is added."
          onCreate={createCraftPillar}
          onUpdate={updateCraftPillar}
          onDelete={deleteCraftPillar}
          fields={[
            { name: "number", label: "Ordinal", hint: "01, 02 — no Arabic twin." },
            { name: "title", label: "Title" },
            { name: "title_ar", label: "Title — Arabic", isTranslation: true },
            { name: "description", label: "Description", kind: "textarea" },
            {
              name: "description_ar",
              label: "Description — Arabic",
              kind: "textarea",
              isTranslation: true,
            },
          ]}
        />
        </div>
      </details>
    </>
  );
}
