import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ContentBackLink from "@/src/components/admin/ContentBackLink";
import ContentRowsEditor from "@/src/components/admin/ContentRowsEditor";
import HeroForm from "@/src/components/admin/HeroForm";
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

/** The bands of `/`, in the order the page renders them. */
const SECTIONS = [
  {
    name: "Hero",
    source: "The first screen — images or a film, and its overlay. Edited below.",
    here: true,
  },
  {
    name: "Collections",
    source: "The featured collections rail — Commerce → Collections.",
  },
  {
    name: "Essences",
    source: "The bestseller band — Commerce → Products.",
  },
  {
    name: "Story",
    source: "The house paragraph — code-owned copy.",
  },
  {
    name: "Craft pillars",
    source: "Edited below.",
    here: true,
  },
  {
    name: "Featured fragrance",
    source: "The full-bleed bottle — System → Settings, “featured fragrance”.",
  },
  {
    name: "Ingredients",
    source: "The materials band — Content → World of KHEM → Ingredients.",
  },
  {
    name: "Journal",
    source: "The latest three articles — Content → World of KHEM → Journal.",
  },
  {
    name: "Testimonials",
    source: "The `Testimonial` table. No editor yet — changed in Supabase.",
  },
  {
    name: "Newsletter",
    source: "The Inner Circle signup — code-owned copy; the list is Marketing → Newsletter.",
  },
] as const;

export default async function AdminLandingContentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [hero, pillars] = await Promise.all([
    getAdminHero(),
    listAdminCraftPillars(),
  ]);

  return (
    <>
      <ContentBackLink
        href={localizePath(activeLocale, "/admin/content")}
        label="Content"
      />

      <AdminPageHeader
        title="Landing Page"
        description="The home page, in the order it is read. Most bands are assembled from records kept elsewhere in the dashboard — the list below says which, so nothing is edited twice."
      />

      <section className="space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Sections
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
            Copy marked code-owned — headings, standfirsts and page metadata —
            is not in the database yet and still needs a developer to change.
          </p>
        </div>

        <ol className="divide-y divide-ground-border border border-ground-border">
          {SECTIONS.map((section, index) => (
            <li
              key={section.name}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-4 sm:px-6"
            >
              <span className="font-heading text-[10px] tabular-nums tracking-[0.2em] text-ground-subtle">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={`font-heading text-[10px] uppercase tracking-[0.2em] ${
                  "here" in section ? "text-ground-accent" : "text-ground"
                }`}
              >
                {section.name}
              </span>
              <span className="basis-full text-[12px] leading-relaxed text-ground-muted sm:basis-auto">
                {section.source}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Hero
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
            The first screen of the home page. Configure images or a film here;
            with neither, the page opens on the typographic composition it has
            always used.
          </p>
        </div>

        {hero ? (
          <HeroForm hero={hero} />
        ) : (
          <p className="border border-ground-border px-5 py-4 text-[12px] leading-relaxed text-ground-muted">
            The hero settings row could not be read. Apply the database
            migrations (<code>npm run db:migrate</code>) and reload.
          </p>
        )}
      </section>

      <section className="mt-12 space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Craft pillars
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
            The four-item summary on the home page. The ordinal has no Arabic
            field — &ldquo;01&rdquo; is written in Western digits in both trees.
          </p>
        </div>

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
      </section>
    </>
  );
}
