import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ExpenseForm from "@/src/components/admin/ExpenseForm";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listExpenseCategories } from "@/src/services/admin/finance";

/**
 * A new expense — or, if it repeats, the rule behind it.
 *
 * The date the desk types is the cost's date for a one-time expense and the
 * *first occurrence* for a recurring one; the form relabels the field so that
 * is never ambiguous.
 */
export const dynamic = "force-dynamic";

export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const categories = await listExpenseCategories();

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
        title="Record an expense"
        description="An operating cost — what it takes to run the house. What the goods themselves cost is set on each product and reported by Sales & Profit; the two are never added together before gross profit."
      />

      <ExpenseForm expense={null} categories={categories} locale={activeLocale} />
    </>
  );
}
