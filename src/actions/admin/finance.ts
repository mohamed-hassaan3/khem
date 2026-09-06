"use server";

/**
 * Finance writes.
 *
 * Shaped after `actions/admin/offers.ts`: `requireAdmin()` first because a
 * Server Action is a public HTTP endpoint and does not inherit the protection
 * of the page that rendered its form, then a Zod parse, then one write through
 * the secret key, then an `AdminActionResult` an editor can act on.
 *
 * ## Three things this module deliberately cannot do
 *
 * 1. **It cannot touch a sale.** No action here reads or writes an order, an
 *    order item, or the sales ledger. Revenue and COGS are read-only facts
 *    Finance consumes.
 * 2. **It cannot rewrite history.** Editing a recurring *rule* changes future
 *    occurrences only; the rows already generated keep the amount they were
 *    written with. Renaming a *category* leaves every expense's snapshotted
 *    `categoryName` where it is.
 * 3. **It cannot quietly destroy an audit trail.** Voiding is the default way
 *    to remove an expense from the books; a hard delete exists for a row typed
 *    by mistake, is a separate confirmed action, and is refused outright for a
 *    category anything points at.
 *
 * Nothing here calls `revalidate*`: Finance has no public surface, and every
 * route under `/admin/finance` is `force-dynamic`.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { AdminActionResult } from "@/src/schemas/admin";
import {
  expenseCategoryRenameSchema,
  expenseCategorySchema,
  expenseEditSchema,
  expenseRuleSchema,
  expenseSchema,
  financialTargetSchema,
} from "@/src/schemas/finance";

import { UNCONFIGURED, fieldErrorsFrom, type PostgresErrorLike } from "./shared";

/**
 * A provider error, as a sentence.
 *
 * Only the constraints this surface can actually trip get their own message;
 * everything else falls through to the generic line with the real message going
 * to the server log, exactly as `postgresFailure()` does for the catalog.
 */
function failure(error: PostgresErrorLike): AdminActionResult {
  const message = error.message ?? "";

  if (message.includes("expense_rule_period_once")) {
    return {
      ok: false,
      message:
        "That period has already been generated for this recurring expense. Nothing was written twice.",
    };
  }

  if (message.includes("expense_rule_window")) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: { endsOn: "The end cannot come before the start." },
    };
  }

  if (message.includes("financial_targets_periodMonth_key")) {
    return {
      ok: false,
      message: "That month already has targets. Open it and edit them instead.",
    };
  }

  if (message.includes("expense_categories_name_key")) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: { name: "Another category already uses that name." },
    };
  }

  if (error.code === "23505") {
    return { ok: false, message: "That value is already used by another row." };
  }

  if (error.code === "23503") {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: { categoryId: "That category no longer exists." },
    };
  }

  return {
    ok: false,
    message: "The database refused that change. The details are in the server log.",
  };
}

/** The category's name and group, for snapshotting onto an expense row. */
async function categorySnapshot(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  categoryId: string,
): Promise<{ name: string; group: string } | null> {
  const { data, error } = await supabase
    .from("expense_categories")
    .select('name, "group"')
    .eq("id", categoryId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as { name?: unknown; group?: unknown };
  return typeof row.name === "string" && typeof row.group === "string"
    ? { name: row.name, group: row.group }
    : null;
}

const NO_CATEGORY: AdminActionResult = {
  ok: false,
  message: "Some fields need attention.",
  fieldErrors: { categoryId: "That category no longer exists." },
};

// ── Expenses ──────────────────────────────────────────────────

/**
 * Record an expense — and, when it repeats, the rule behind it.
 *
 * A recurring expense creates the *rule* and then asks the generator to write
 * every occurrence due so far. The row the desk was describing is one of those,
 * so nothing is inserted directly: one code path writes every generated row,
 * which is what stops a hand-written first month sitting beside a generated one
 * with a different shape.
 */
export async function createExpense(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const data = parsed.data;
  const category = await categorySnapshot(supabase, data.categoryId);
  if (!category) return NO_CATEGORY;

  if (data.repeats !== "none") {
    const { data: rule, error } = await supabase
      .from("expense_recurring_rules")
      .insert({
        name: data.name,
        categoryId: data.categoryId,
        amountInCents: data.amount,
        cadence: data.repeats,
        startsOn: data.incurredOn,
        endsOn: data.endsOn,
        vendor: data.vendor,
        notes: data.notes,
        isActive: true,
        createdBy: actor.email,
        updatedBy: actor.email,
      })
      .select("id, name")
      .maybeSingle();

    if (error) {
      console.error(`[admin] createExpense rule rejected (${actor.email}): ${error.message}`);
      return failure(error as PostgresErrorLike);
    }

    if (!rule) return { ok: false, message: "The recurring expense could not be created." };

    const { error: genError } = await supabase.rpc("generate_recurring_expenses", {});

    if (genError) {
      console.error(`[admin] createExpense generation failed: ${genError.message}`);
      return {
        ok: false,
        message:
          "The recurring expense was created, but its occurrences could not be written. Open Finance again to retry.",
      };
    }

    console.info(`[admin] recurring expense created by ${actor.email} → ${data.name}`);

    return {
      ok: true,
      slug: String(rule.id),
      message: `${data.name} recorded, and will repeat ${
        data.repeats === "MONTHLY" ? "monthly" : "yearly"
      }.`,
    };
  }

  const { data: row, error } = await supabase
    .from("expenses")
    .insert({
      name: data.name,
      categoryId: data.categoryId,
      categoryName: category.name,
      categoryGroup: category.group,
      amountInCents: data.amount,
      incurredOn: data.incurredOn,
      status: data.status,
      vendor: data.vendor,
      reference: data.reference,
      notes: data.notes,
      createdBy: actor.email,
      updatedBy: actor.email,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[admin] createExpense rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (!row) return { ok: false, message: "The expense could not be recorded." };

  console.info(`[admin] expense created by ${actor.email} → ${data.name}`);

  return { ok: true, slug: String(row.id), message: `${data.name} recorded.` };
}

/**
 * Correct one expense.
 *
 * The category snapshot is **re-taken** here, because moving an expense from
 * Rent to Premises is a correction of where the cost belongs and should show up
 * in the breakdown as such. That is a different act from *renaming* a category,
 * which must never touch a row — see `renameExpenseCategory()`.
 */
export async function updateExpense(
  id: string,
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = expenseEditSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const data = parsed.data;
  const category = await categorySnapshot(supabase, data.categoryId);
  if (!category) return NO_CATEGORY;

  const { error } = await supabase
    .from("expenses")
    .update({
      name: data.name,
      categoryId: data.categoryId,
      categoryName: category.name,
      categoryGroup: category.group,
      amountInCents: data.amount,
      incurredOn: data.incurredOn,
      status: data.status,
      vendor: data.vendor,
      reference: data.reference,
      notes: data.notes,
      // Set when the status is VOID, cleared when it is not — so restoring a
      // voided expense does not leave a timestamp claiming it is still void.
      voidedAt: data.status === "VOID" ? new Date().toISOString() : null,
      updatedBy: actor.email,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error(`[admin] updateExpense rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  console.info(`[admin] expense ${id} updated by ${actor.email}`);

  return { ok: true, slug: id, message: "Expense saved." };
}

/**
 * The status switch on the expenses table.
 *
 * Separate from `updateExpense` so marking a row paid — or voiding one in a
 * hurry — does not require passing validation on every other field first, the
 * same shape `setOfferActive()` has.
 */
export async function setExpenseStatus(
  id: string,
  status: "PENDING" | "PAID" | "VOID",
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase
    .from("expenses")
    .update({
      status,
      voidedAt: status === "VOID" ? new Date().toISOString() : null,
      updatedBy: actor.email,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error(`[admin] setExpenseStatus rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  console.info(`[admin] expense ${id} set ${status} by ${actor.email}`);

  return {
    ok: true,
    slug: id,
    message:
      status === "VOID"
        ? "Expense voided. It stays in the ledger and counts nowhere."
        : status === "PAID"
          ? "Marked paid."
          : "Marked unpaid.",
  };
}

/**
 * Delete an expense outright.
 *
 * Offered only for a row somebody typed by mistake, and never the default —
 * §12 asks for void over destruction, and voiding is what the status control
 * does. A generated row is refused: deleting it would only make the generator
 * write it again on the next dashboard read, which looks like the delete
 * silently failed.
 */
export async function deleteExpense(id: string): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data: row } = await supabase
    .from("expenses")
    .select('id, "recurringRuleId"')
    .eq("id", id)
    .maybeSingle();

  if (row && (row as { recurringRuleId?: unknown }).recurringRuleId) {
    return {
      ok: false,
      message:
        "This expense was generated by a recurring rule and would be written again. Void it instead, or stop the rule.",
    };
  }

  const { error } = await supabase.from("expenses").delete().eq("id", id);

  if (error) {
    console.error(`[admin] deleteExpense rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  console.info(`[admin] expense ${id} deleted by ${actor.email}`);

  return { ok: true, slug: id, message: "Expense deleted." };
}

// ── Recurring rules ───────────────────────────────────────────

/**
 * Edit a rule.
 *
 * **Future periods only.** The rows already generated carry the amount they were
 * written with and are not touched here — that is the whole of §17, and the
 * form says so above the amount field. Generation runs afterwards so a widened
 * window (a later `endsOn`, an earlier `startsOn`) fills in immediately.
 */
export async function updateExpenseRule(
  id: string,
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = expenseRuleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const data = parsed.data;

  const { error } = await supabase
    .from("expense_recurring_rules")
    .update({
      name: data.name,
      categoryId: data.categoryId,
      amountInCents: data.amount,
      cadence: data.cadence,
      startsOn: data.startsOn,
      endsOn: data.endsOn,
      vendor: data.vendor,
      notes: data.notes,
      isActive: data.isActive,
      updatedBy: actor.email,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error(`[admin] updateExpenseRule rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  const { error: genError } = await supabase.rpc("generate_recurring_expenses", {});
  if (genError) console.error(`[admin] rule generation failed: ${genError.message}`);

  console.info(`[admin] recurring expense ${id} updated by ${actor.email}`);

  return {
    ok: true,
    slug: id,
    message: "Saved. Periods already recorded keep the amount they were written with.",
  };
}

/**
 * Stop or restart a rule.
 *
 * Stopping writes no more occurrences and removes none: the months already
 * recorded are what the house actually spent.
 */
export async function setExpenseRuleActive(
  id: string,
  isActive: boolean,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase
    .from("expense_recurring_rules")
    .update({ isActive, updatedBy: actor.email, updatedAt: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error(`[admin] setExpenseRuleActive rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (isActive) {
    const { error: genError } = await supabase.rpc("generate_recurring_expenses", {});
    if (genError) console.error(`[admin] rule generation failed: ${genError.message}`);
  }

  console.info(`[admin] recurring expense ${id} ${isActive ? "resumed" : "stopped"} by ${actor.email}`);

  return {
    ok: true,
    slug: id,
    message: isActive
      ? "Recurring again. Any missed periods have been written."
      : "Stopped. The periods already recorded are unchanged.",
  };
}

/**
 * Delete a rule.
 *
 * `expenses."recurringRuleId"` is `on delete set null`, so the occurrences
 * survive as ordinary one-time expenses — which is the correct outcome: the
 * house did pay that rent, whatever happened to the template afterwards.
 */
export async function deleteExpenseRule(id: string): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  /*
   * Both columns are cleared, in one update, before the rule goes.
   *
   * `expense_recurrence_complete` requires them to be null together or set
   * together, so relying on the foreign key's `on delete set null` would clear
   * one and leave the other — and the delete would fail on the check. Doing it
   * here also means a failure leaves the rule in place rather than orphaning
   * half a ledger.
   */
  const { error: detachError } = await supabase
    .from("expenses")
    .update({
      recurringRuleId: null,
      periodKey: null,
      updatedBy: actor.email,
      updatedAt: new Date().toISOString(),
    })
    .eq("recurringRuleId", id);

  if (detachError) {
    console.error(`[admin] deleteExpenseRule detach failed: ${detachError.message}`);
    return failure(detachError as PostgresErrorLike);
  }

  const { error } = await supabase.from("expense_recurring_rules").delete().eq("id", id);

  if (error) {
    console.error(`[admin] deleteExpenseRule rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  console.info(`[admin] recurring expense ${id} deleted by ${actor.email}`);

  return {
    ok: true,
    slug: id,
    message: "Recurring expense removed. The costs it recorded are still in the ledger.",
  };
}

/** Write any occurrence that is due — the button behind the automatic call. */
export async function runRecurringGeneration(): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase.rpc("generate_recurring_expenses", {});

  if (error) {
    console.error(`[admin] runRecurringGeneration failed (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  const written = typeof data === "number" ? data : 0;

  return {
    ok: true,
    slug: "recurring",
    message:
      written === 0
        ? "Everything due is already recorded."
        : `${written} expense${written === 1 ? "" : "s"} written.`,
  };
}

// ── Targets ───────────────────────────────────────────────────

/**
 * Set or replace one month's targets.
 *
 * An upsert on `"periodMonth"` rather than an insert-or-update dance: the
 * column is unique, so the database decides which it is and two people saving
 * the same month cannot produce two rows.
 */
export async function saveFinancialTarget(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = financialTargetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const data = parsed.data;

  const { error } = await supabase.from("financial_targets").upsert(
    {
      periodMonth: data.periodMonth,
      revenueTargetInCents: data.revenueTarget,
      grossProfitTargetInCents: data.grossProfitTarget,
      netProfitTargetInCents: data.netProfitTarget,
      notes: data.notes,
      createdBy: actor.email,
      updatedBy: actor.email,
      updatedAt: new Date().toISOString(),
    },
    { onConflict: "periodMonth" },
  );

  if (error) {
    console.error(`[admin] saveFinancialTarget rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  console.info(`[admin] targets for ${data.periodMonth} saved by ${actor.email}`);

  return { ok: true, slug: data.periodMonth, message: "Targets saved." };
}

/** Clear a month's targets entirely — different from setting them to zero. */
export async function deleteFinancialTarget(
  periodMonth: string,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase
    .from("financial_targets")
    .delete()
    .eq("periodMonth", periodMonth);

  if (error) {
    console.error(`[admin] deleteFinancialTarget rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  console.info(`[admin] targets for ${periodMonth} cleared by ${actor.email}`);

  return { ok: true, slug: periodMonth, message: "Targets cleared." };
}

// ── Categories ────────────────────────────────────────────────

export async function createExpenseCategory(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = expenseCategorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const data = parsed.data;

  const { error } = await supabase.from("expense_categories").insert({
    id: data.id,
    name: data.name,
    group: data.group,
    sortOrder: data.sortOrder,
    isSystem: false,
  });

  if (error) {
    console.error(`[admin] createExpenseCategory rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  console.info(`[admin] expense category ${data.id} created by ${actor.email}`);

  return { ok: true, slug: data.id, message: `${data.name} added.` };
}

/**
 * Rename a category, or move it between groups.
 *
 * **No expense row is touched.** Every one of them carries the name it was
 * written under, and that is what the reports group by — so a category renamed
 * today cannot change what September says it spent. New expenses will carry the
 * new name; the two coexist in the breakdown, which is the honest outcome.
 */
export async function renameExpenseCategory(
  id: string,
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = expenseCategoryRenameSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase
    .from("expense_categories")
    .update({
      name: parsed.data.name,
      group: parsed.data.group,
      sortOrder: parsed.data.sortOrder,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error(`[admin] renameExpenseCategory rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  console.info(`[admin] expense category ${id} renamed by ${actor.email}`);

  return {
    ok: true,
    slug: id,
    message: "Category saved. Expenses already recorded keep the name they were written under.",
  };
}

/** Hide a category from the forms without disturbing anything recorded under it. */
export async function setExpenseCategoryArchived(
  id: string,
  isArchived: boolean,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase
    .from("expense_categories")
    .update({ isArchived, updatedAt: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error(`[admin] setExpenseCategoryArchived rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  console.info(`[admin] expense category ${id} ${isArchived ? "archived" : "restored"} by ${actor.email}`);

  return {
    ok: true,
    slug: id,
    message: isArchived ? "Category archived." : "Category restored.",
  };
}

/**
 * Delete a category.
 *
 * Refused for a shipped default (the migration's seed would recreate it on the
 * next `db:migrate`, which looks like the delete failed) and refused for one
 * anything points at (the foreign key would refuse anyway; this says why). The
 * answer in both cases is to archive it.
 */
export async function deleteExpenseCategory(id: string): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data: category } = await supabase
    .from("expense_categories")
    .select('id, "isSystem"')
    .eq("id", id)
    .maybeSingle();

  if (category && (category as { isSystem?: unknown }).isSystem === true) {
    return {
      ok: false,
      message:
        "This is one of the categories KHEM ships with, so it would come back on the next migration. Archive it instead.",
    };
  }

  const { count } = await supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("categoryId", id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: `${count} expense${count === 1 ? "" : "s"} are recorded under this category. Archive it instead — deleting it would break their history.`,
    };
  }

  const { error } = await supabase.from("expense_categories").delete().eq("id", id);

  if (error) {
    console.error(`[admin] deleteExpenseCategory rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  console.info(`[admin] expense category ${id} deleted by ${actor.email}`);

  return { ok: true, slug: id, message: "Category deleted." };
}
