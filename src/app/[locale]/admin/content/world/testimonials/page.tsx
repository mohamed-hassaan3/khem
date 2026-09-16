import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ContentBackLink from "@/src/components/admin/ContentBackLink";
import ContentRowsEditor from "@/src/components/admin/ContentRowsEditor";
import {
  createTestimonial,
  deleteTestimonial,
  updateTestimonial,
} from "@/src/actions/admin/content";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listAdminTestimonials } from "@/src/services/admin/content";

export const dynamic = "force-dynamic";

export default async function AdminTestimonialsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";
  const testimonials = await listAdminTestimonials();

  return (
    <>
      <ContentBackLink
        href={localizePath(activeLocale, "/admin/content/world")}
        label="World of KHEM"
      />
      <AdminPageHeader
        title="Testimonials"
        description="The customer voices shown on the home page."
      />
      <ContentRowsEditor
        rows={testimonials}
        headingField="author"
        entityLabel="testimonial"
        emptyMessage="No testimonials. Add the first customer voice below."
        onCreate={createTestimonial}
        onUpdate={updateTestimonial}
        onDelete={deleteTestimonial}
        fields={[
          { name: "quote", label: "Quote", kind: "textarea" },
          { name: "quote_ar", label: "Quote — Arabic", kind: "textarea", isTranslation: true },
          { name: "author", label: "Author" },
          { name: "author_ar", label: "Author — Arabic", isTranslation: true },
          { name: "authorTitle", label: "Author title" },
          { name: "authorTitle_ar", label: "Author title — Arabic", isTranslation: true },
          { name: "isPublished", label: "Published", kind: "toggle", hint: "Published testimonials appear on the home page." },
        ]}
      />
    </>
  );
}