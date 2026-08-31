import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ContentHubCard from "@/src/components/admin/ContentHubCard";
import { isLocale, localizePath } from "@/src/lib/i18n/config";

/**
 * The CMS entrance.
 *
 * ## Why this page is now two links and nothing else
 *
 * It used to be seven row-editors stacked on one scroll — the heritage
 * timeline, the craft pillars, the brand values, the atelier stages, the craft
 * figures, the perfumer's quote and the mission statements — which is the whole
 * editorial site in a single column, grouped by table. An editor arriving to
 * fix one sentence on /craftsmanship had to know which of seven headings owned
 * it.
 *
 * The editors themselves have not changed. They have been dealt out to the page
 * each one feeds, and this is the question that comes before them: *which part
 * of the website?*
 *
 * ## Editors over the tables that exist, not a generic section CMS
 *
 * `supabase/AGENTS.md` §15 asks for reusable section types instead of a table
 * per visual section. The site runs on twelve purpose-built, typed content
 * tables that feed live pages and are validated by Zod on read; migrating them
 * into a generic `content_section` would rewrite working pages and flatten
 * shapes the schemas currently check. §15's *intent* — an editor changes this
 * without a deploy — is met here; its suggested mechanism is not, deliberately.
 */
export const dynamic = "force-dynamic";

export default async function AdminContentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  return (
    <>
      <AdminPageHeader
        title="Content"
        description="The website, as the website is arranged. Choose the area you want to edit, then the page, then the section. Arabic fields left empty fall back to the English text — they do not render blank."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <ContentHubCard
          href={localizePath(activeLocale, "/admin/content/landing")}
          title="Landing Page"
          description="The home page — the craft pillars, the featured fragrance, and what is drawn from elsewhere in the dashboard."
        />
        <ContentHubCard
          href={localizePath(activeLocale, "/admin/content/world")}
          title="World of KHEM"
          description="Heritage, Craftsmanship, Ingredients, Journal and About KHEM — the editorial pages behind the house."
        />
      </div>
    </>
  );
}
