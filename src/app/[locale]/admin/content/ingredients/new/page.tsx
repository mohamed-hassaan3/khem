import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import IngredientForm from "@/src/components/admin/IngredientForm";
import { isLocale, localizePath } from "@/src/lib/i18n/config";

/**
 * A new material.
 *
 * The perfumes it appears in are not on this screen: `"IngredientUsage"` rows
 * point at an id that does not exist until the material is saved, so the form
 * hands over to the edit page the moment it is.
 */
export const dynamic = "force-dynamic";

export default async function NewIngredientPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  return (
    <>
      <Link
        href={localizePath(activeLocale, "/admin/content/ingredients")}
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
      >
        <ArrowLeft size={13} strokeWidth={1.25} />
        All ingredients
      </Link>

      <AdminPageHeader
        title="Add a material"
        description="Once saved, you can say which perfumes it is printed on."
      />

      <IngredientForm ingredient={null} locale={activeLocale} />
    </>
  );
}
