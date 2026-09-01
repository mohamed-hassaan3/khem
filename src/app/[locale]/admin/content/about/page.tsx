import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ContentBackLink from "@/src/components/admin/ContentBackLink";
import ContentRowsEditor from "@/src/components/admin/ContentRowsEditor";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  createMissionStatement,
  deleteMissionStatement,
  updateMissionStatement,
} from "@/src/actions/admin/content";
import { listAdminMissionStatements } from "@/src/services/admin/content";

/**
 * /about, section by section.
 *
 * One editor today, and a page of its own regardless: About KHEM is a page of
 * the public site, and the CMS is arranged by page. A screen that holds one
 * thing is a screen an editor can find.
 */
export const dynamic = "force-dynamic";

export default async function AdminAboutContentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const statements = await listAdminMissionStatements();

  return (
    <>
      <ContentBackLink
        href={localizePath(activeLocale, "/admin/content/world")}
        label="World of KHEM"
      />

      <AdminPageHeader
        title="About KHEM"
        description="The editorial sections on /about. Arabic fields left empty fall back to the English text — they do not render blank."
      />

      <section className="space-y-5">
        <div>
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Mission statements
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
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
