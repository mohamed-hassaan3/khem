import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ExpenseForm from "@/src/components/admin/ExpenseForm";
import { dayLabel } from "@/src/lib/admin/finance";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getExpense, listExpenseCategories } from "@/src/services/admin/finance";

/**
 * One expense.
 *
 * A row a rule generated can be corrected here — a typo is a typo — but it
 * cannot be detached from its rule or turned into one, and the form says so.
 * That decision belongs on the rule's own screen, where the consequence for
 * every other period is visible.
 */
export const dynamic = "force-dynamic";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [expense, categories] = await Promise.all([
    getExpense(id),
    listExpenseCategories(),
  ]);

  if (!expense) notFound();

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
        title={expense.name}
        description={`Recorded against ${dayLabel(expense.incurredOn)}, under ${expense.categoryName}.${
          expense.isRecurring ? " Written by a recurring expense." : ""
        }`}
      />

      <ExpenseForm expense={expense} categories={categories} locale={activeLocale} />
    </>
  );
}
