import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ContentBackLink from "@/src/components/admin/ContentBackLink";
import ContentRowsEditor from "@/src/components/admin/ContentRowsEditor";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  createCraftQuote,
  createCraftStat,
  createCraftStep,
  deleteCraftQuote,
  deleteCraftStat,
  deleteCraftStep,
  updateCraftQuote,
  updateCraftStat,
  updateCraftStep,
} from "@/src/actions/admin/content";
import {
  listAdminCraftQuotes,
  listAdminCraftStats,
  listAdminCraftSteps,
} from "@/src/services/admin/content";

/**
 * /craftsmanship, section by section.
 *
 * The craft *pillars* are deliberately not here: that table feeds the home
 * page, not this one, and it now sits under Content → Landing Page. Grouping by
 * the page a row appears on is the whole point of this arrangement — a table
 * called `CraftPillar` on a screen called Craftsmanship would be grouping by
 * name.
 */
export const dynamic = "force-dynamic";

export default async function AdminCraftsmanshipContentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [steps, stats, quotes] = await Promise.all([
    listAdminCraftSteps(),
    listAdminCraftStats(),
    listAdminCraftQuotes(),
  ]);

  return (
    <>
      <ContentBackLink
        href={localizePath(activeLocale, "/admin/content/world")}
        label="World of KHEM"
      />

      <AdminPageHeader
        title="Craftsmanship"
        description="The editorial sections on /craftsmanship. Arabic fields left empty fall back to the English text — they do not render blank."
      />

      <section className="space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Atelier stages
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
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
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Craft figures
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
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
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Perfumer&rsquo;s quote
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
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
    </>
  );
}
