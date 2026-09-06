import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import RecurringExpenseForm from "@/src/components/admin/RecurringExpenseForm";
import { EXPENSE_CADENCE_LABEL, dayLabel } from "@/src/lib/admin/finance";
import { egpCompact } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  getExpenseRule,
  listExpenseCategories,
} from "@/src/services/admin/finance";

/**
 * One recurring expense — the template.
 *
 * Editing it changes the periods not yet written and nothing else. The header
 * states how many have been recorded so the consequence of a change is visible
 * before it is made rather than discovered afterwards.
 */
export const dynamic = "force-dynamic";

export default async function EditRecurringExpensePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [rule, categories] = await Promise.all([
    getExpenseRule(id),
    listExpenseCategories(),
  ]);

  if (!rule) notFound();

  const generated = rule.generatedCount ?? 0;

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
        title={rule.name}
        description={`${EXPENSE_CADENCE_LABEL[rule.cadence]}, ${egpCompact(rule.amountInCents)}, from ${dayLabel(rule.startsOn)}${
          rule.endsOn ? ` to ${dayLabel(rule.endsOn)}` : " with no end date"
        }. ${
          generated === 0
            ? "Nothing recorded from it yet."
            : `${generated} ${generated === 1 ? "period" : "periods"} recorded so far.`
        }`}
      />

      <RecurringExpenseForm rule={rule} categories={categories} locale={activeLocale} />
    </>
  );
}
