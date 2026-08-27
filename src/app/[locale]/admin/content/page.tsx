import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ContentRowsEditor from "@/src/components/admin/ContentRowsEditor";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  createBrandValue,
  createCraftPillar,
  createCraftQuote,
  createCraftStat,
  createCraftStep,
  createMissionStatement,
  createTimelineEvent,
  deleteBrandValue,
  deleteCraftPillar,
  deleteCraftQuote,
  deleteCraftStat,
  deleteCraftStep,
  deleteMissionStatement,
  deleteTimelineEvent,
  updateBrandValue,
  updateCraftPillar,
  updateCraftQuote,
  updateCraftStat,
  updateCraftStep,
  updateMissionStatement,
  updateTimelineEvent,
} from "@/src/actions/admin/content";
import {
  listAdminBrandValues,
  listAdminCraftPillars,
  listAdminCraftQuotes,
  listAdminCraftStats,
  listAdminCraftSteps,
  listAdminMissionStatements,
  listAdminTimeline,
} from "@/src/services/admin/content";

/**
 * Editorial content.
 *
 * ## Editors over the tables that exist, not a generic section CMS
 *
 * `supabase/AGENTS.md` §15 asks for reusable section types instead of a table
 * per visual section. The site runs on twelve purpose-built, typed content
 * tables that feed live pages and are validated by Zod on read; migrating them
 * into a generic `content_section` would rewrite working pages and flatten
 * shapes the schemas currently check. §15's *intent* — an editor changes this
 * without a deploy — is met here; its suggested mechanism is not, deliberately.
 *
 * ## The Arabic columns were unreachable until now
 *
 * `supabase/sql/0008_i18n_content.sql` gave both these tables Arabic twins.
 * Every one of them is empty, and until this phase the read path did not select
 * them at all — so `/ar/heritage` rendered the English timeline. The columns are
 * now read through `resolveText()`, which falls back to English while they stay
 * empty, and this screen is where they get filled in.
 *
 * Seven tables, grouped by the page each one feeds rather than by the table it
 * lives in — an editor comes here to fix /craftsmanship, not to fix
 * `"CraftStat"`. The ingredients (`Ingredient`, `IngredientFamily`,
 * `IngredientUsage`) are a genuine relation with an array column and get their
 * own editor rather than a rows list.
 */
export const dynamic = "force-dynamic";

export default async function AdminContentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [timeline, values, pillars, steps, stats, quotes, statements] =
    await Promise.all([
      listAdminTimeline(),
      listAdminBrandValues(),
      listAdminCraftPillars(),
      listAdminCraftSteps(),
      listAdminCraftStats(),
      listAdminCraftQuotes(),
      listAdminMissionStatements(),
    ]);

  return (
    <>
      <AdminPageHeader
        title="Content"
        description="The editorial copy behind the heritage and home pages. Arabic fields left empty fall back to the English text — they do not render blank."
      />

      <Link
        href={localizePath(activeLocale, "/admin/content/ingredients")}
        className="mb-10 flex items-center justify-between gap-4 border border-border bg-ivory/2 p-5 transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-gold/30 sm:p-6"
      >
        <span>
          <span className="block font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
            Ingredients
          </span>
          <span className="mt-2 block text-[12px] leading-relaxed text-ivory/45">
            The raw materials. A record rather than a row — its own screen, with
            a photograph, provenance notes and the perfumes it is printed on.
          </span>
        </span>
        <ArrowRight
          size={16}
          strokeWidth={1.25}
          aria-hidden
          className="shrink-0 text-gold/60"
        />
      </Link>

      <section className="space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
            Heritage timeline
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ivory/35">
            The dated moments on /heritage. The year is display text rather than
            a date, which is why it has an Arabic field of its own — &ldquo;3000
            BC&rdquo; becomes &ldquo;٣٠٠٠ ق.م&rdquo;.
          </p>
        </div>

        <ContentRowsEditor
          rows={timeline}
          headingField="title"
          entityLabel="timeline entry"
          emptyMessage="No timeline entries. The heritage page renders its rail empty until one is added."
          onCreate={createTimelineEvent}
          onUpdate={updateTimelineEvent}
          onDelete={deleteTimelineEvent}
          fields={[
            { name: "year", label: "Year", hint: "Display text — 3000 BC." },
            { name: "year_ar", label: "Year — Arabic", isTranslation: true },
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

      <section className="mt-12 space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
            Craft pillars
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ivory/35">
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

      <section className="mt-12 space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
            Brand values
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ivory/35">
            The values panel further down /heritage.
          </p>
        </div>

        <ContentRowsEditor
          rows={values}
          headingField="title"
          entityLabel="value"
          emptyMessage="No brand values. The heritage page hides the panel until one is added."
          onCreate={createBrandValue}
          onUpdate={updateBrandValue}
          onDelete={deleteBrandValue}
          fields={[
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

      <section className="mt-12 space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
            Atelier stages
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ivory/35">
            The numbered process on /craftsmanship. One photograph serves both
            languages — only its description changes.
          </p>
        </div>

        <ContentRowsEditor
          rows={steps}
          headingField="title"
          entityLabel="stage"
          emptyMessage="No atelier stages. The craftsmanship page renders its process empty until one is added."
          onCreate={createCraftStep}
          onUpdate={updateCraftStep}
          onDelete={deleteCraftStep}
          fields={[
            { name: "number", label: "Ordinal", hint: "01, 02 — no Arabic twin." },
            { name: "title", label: "Title" },
            { name: "title_ar", label: "Title — Arabic", isTranslation: true },
            { name: "subtitle", label: "Gold line", hint: "The italic line under the title." },
            { name: "subtitle_ar", label: "Gold line — Arabic", isTranslation: true },
            { name: "body", label: "Body", kind: "textarea" },
            { name: "body_ar", label: "Body — Arabic", kind: "textarea", isTranslation: true },
            { name: "imageUrl", label: "Image URL" },
            { name: "imageAlt", label: "Alt text" },
            { name: "imageAlt_ar", label: "Alt text — Arabic", isTranslation: true },
          ]}
        />
      </section>

      <section className="mt-12 space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
            Craft figures
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ivory/35">
            The stat band on /craftsmanship. Leave the Arabic figure empty for
            anything like &ldquo;300+&rdquo; or &ldquo;100%&rdquo;, which reads
            the same in both scripts.
          </p>
        </div>

        <ContentRowsEditor
          rows={stats}
          headingField="label"
          entityLabel="figure"
          emptyMessage="No figures. The stat band is hidden until one is added."
          onCreate={createCraftStat}
          onUpdate={updateCraftStat}
          onDelete={deleteCraftStat}
          fields={[
            { name: "value", label: "Figure", hint: "300+, 100%, 24" },
            { name: "value_ar", label: "Figure — Arabic", isTranslation: true },
            { name: "label", label: "Label" },
            { name: "label_ar", label: "Label — Arabic", isTranslation: true },
          ]}
        />
      </section>

      <section className="mt-12 space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
            Perfumer&rsquo;s quote
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ivory/35">
            /craftsmanship prints the first published quote by sort order.
            Unpublishing one hides it from the site entirely — the row stays
            here, and only this screen can still see it.
          </p>
        </div>

        <ContentRowsEditor
          rows={quotes}
          headingField="author"
          entityLabel="quote"
          emptyMessage="No quotes. The craftsmanship page omits the section until one is published."
          onCreate={createCraftQuote}
          onUpdate={updateCraftQuote}
          onDelete={deleteCraftQuote}
          fields={[
            { name: "quote", label: "Quote", kind: "textarea" },
            { name: "quote_ar", label: "Quote — Arabic", kind: "textarea", isTranslation: true },
            { name: "author", label: "Author" },
            { name: "author_ar", label: "Author — Arabic", isTranslation: true },
            { name: "authorTitle", label: "Role" },
            { name: "authorTitle_ar", label: "Role — Arabic", isTranslation: true },
            {
              name: "isPublished",
              label: "Published",
              kind: "toggle",
              hint: "Unpublished quotes are invisible to the public site.",
            },
          ]}
        />
      </section>

      <section className="mt-12 space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
            Mission statements
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ivory/35">
            The labelled sections on /about.
          </p>
        </div>

        <ContentRowsEditor
          rows={statements}
          headingField="title"
          entityLabel="statement"
          emptyMessage="No mission statements. The about page hides the section until one is added."
          onCreate={createMissionStatement}
          onUpdate={updateMissionStatement}
          onDelete={deleteMissionStatement}
          fields={[
            { name: "label", label: "Label", hint: "Mission, Vision…" },
            { name: "label_ar", label: "Label — Arabic", isTranslation: true },
            { name: "title", label: "Title" },
            { name: "title_ar", label: "Title — Arabic", isTranslation: true },
            { name: "text", label: "Text", kind: "textarea" },
            { name: "text_ar", label: "Text — Arabic", kind: "textarea", isTranslation: true },
          ]}
        />
      </section>
    </>
  );
}
