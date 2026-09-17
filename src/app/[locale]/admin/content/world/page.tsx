import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ContentBackLink from "@/src/components/admin/ContentBackLink";
import ContentHubCard from "@/src/components/admin/ContentHubCard";
import { isLocale, localizePath } from "@/src/lib/i18n/config";

/**
 * The five editorial pages, as five pages.
 *
 * Two of them keep routes that predate this arrangement — Ingredients under
 * `/admin/content/ingredients`, Journal at `/admin/journal`. Neither moved.
 * Where an editor *looks* for something and where it is *stored* are separate
 * questions, and renaming a working route to make a menu tidier costs
 * bookmarks, redirects and a hundred references for nothing.
 */
export const dynamic = "force-dynamic";

export default async function AdminWorldPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  return (
    <>
      <ContentBackLink
        href={localizePath(activeLocale, "/admin/content")}
        label="Content"
      />

      <AdminPageHeader
        title="World of KHEM"
        description="The editorial pages. Each one below is a page of the public site — open it to edit the sections it is built from."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <ContentHubCard
          href={localizePath(activeLocale, "/admin/content/heritage")}
          title="Heritage"
          description="The dated timeline and the values panel on /heritage."
        />
        <ContentHubCard
          href={localizePath(activeLocale, "/admin/content/craftsmanship")}
          title="Craftsmanship"
          description="The atelier stages, the stat band and the perfumer's quote on /craftsmanship."
        />
        <ContentHubCard
          href={localizePath(activeLocale, "/admin/content/ingredients")}
          title="Ingredients"
          description="The raw materials. A record rather than a row — its own screen, with a photograph, provenance notes and the perfumes it is printed on."
        />
        <ContentHubCard
          href={localizePath(activeLocale, "/admin/journal")}
          title="Journal"
          description="The editorial articles — write, publish, unpublish, and set the image and author each one carries."
        />
        <ContentHubCard
          href={localizePath(activeLocale, "/admin/content/about")}
          title="About KHEM"
          description="The labelled mission and vision sections on /about."
        />
        <ContentHubCard
          href={localizePath(activeLocale, "/admin/content/world/testimonials")}
          title="Testimonials"
          description="The customer voices shown in the Testimonials band on the home page."
        />
      </div>
    </>
  );
}
