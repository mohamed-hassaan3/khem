import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ContentBackLink from "@/src/components/admin/ContentBackLink";
import ContentRowsEditor from "@/src/components/admin/ContentRowsEditor";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  createBrandValue,
  createTimelineEvent,
  deleteBrandValue,
  deleteTimelineEvent,
  updateBrandValue,
  updateTimelineEvent,
} from "@/src/actions/admin/content";
import {
  listAdminBrandValues,
  listAdminTimeline,
} from "@/src/services/admin/content";

/**
 * /heritage, section by section.
 *
 * The two editors are the ones that used to sit first and third on the old
 * combined Content screen, unchanged — same actions, same services, same
 * fields. What changed is that they are now on the page they feed, so an editor
 * opening Heritage sees the heritage page and nothing else.
 *
 * ## The Arabic columns
 *
 * `supabase/sql/0008_i18n_content.sql` gave both these tables Arabic twins, and
 * the read path resolves them through `resolveText()` — an empty Arabic field
 * falls back to the English text rather than rendering blank. This is where
 * they get filled in.
 */
export const dynamic = "force-dynamic";

export default async function AdminHeritageContentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [timeline, values] = await Promise.all([
    listAdminTimeline(),
    listAdminBrandValues(),
  ]);

  return (
    <>
      <ContentBackLink
        href={localizePath(activeLocale, "/admin/content/world")}
        label="World of KHEM"
      />

      <AdminPageHeader
        title="Heritage"
        description="The editorial sections on /heritage. Arabic fields left empty fall back to the English text — they do not render blank."
      />

      <section className="space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Heritage timeline
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
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
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Brand values
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
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
    </>
  );
}
