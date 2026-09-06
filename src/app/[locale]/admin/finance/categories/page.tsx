import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ExpenseCategoryEditor from "@/src/components/admin/ExpenseCategoryEditor";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listExpenseCategoriesWithUse } from "@/src/services/admin/finance";

/**
 * Expense categories.
 *
 * KHEM ships with thirty-four of them and the desk owns the list from there.
 * Renaming one is safe by construction: every expense carries the name it was
 * *written under*, and the reports group on that snapshot, so a rename changes
 * what new expenses will say and changes no month that has already been
 * reported.
 *
 * Not in the rail on purpose — this is a setup screen somebody visits twice a
 * year, reached from Expenses where the need for it arises.
 */

export const dynamic = "force-dynamic";

export default async function AdminExpenseCategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const categories = await listExpenseCategoriesWithUse();

  return (
    <>
      <Link
        href={localizePath(activeLocale, "/admin/finance/expenses")}
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
      >
        <ArrowLeft size={13} strokeWidth={1.25} />
        All expenses
      </Link>

      <AdminPageHeader
        title="Expense categories"
        description="Where operating costs are filed. Renaming one is safe — every expense keeps the name it was recorded under, so no closed month is ever re-labelled. Archive a category to retire it without disturbing its history."
      />

      <p className="mb-8 max-w-2xl text-[11px] leading-relaxed text-ground-muted">
        None of these is a cost of goods. What a bottle costs the house is set on
        the product itself and reported by Sales &amp; Profit — adding it here
        would count it twice and make every margin wrong.
      </p>

      <ExpenseCategoryEditor categories={categories} />
    </>
  );
}
