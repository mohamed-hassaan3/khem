/**
 * Finance write validation.
 *
 * The twin of `supabase/sql/0063_finance.sql`'s column checks, plus the rules a
 * column check cannot express — a recurring expense needs a cadence, a rule's
 * end must not precede its start, a target month must be a real month.
 *
 * ## Money arrives as pounds and is stored as piastres
 *
 * Every other admin form in this repository takes a price in the minor unit,
 * because a product's price is quoted that way in the catalog. An expense is
 * not: nobody types rent as `4000000`. So these schemas accept **pounds** —
 * with up to two decimal places — and convert once, here, so exactly one place
 * in the codebase knows the factor and no component ever multiplies money.
 */

import { z } from "zod";

/**
 * Pounds in, piastres out.
 *
 * `Math.round` rather than a truncation: `19.99 * 100` is `1998.9999999999998`
 * in IEEE 754, and truncating it would quietly lose a piastre on a value the
 * desk typed exactly.
 */
const amountInPounds = z
  .union([z.literal(""), z.coerce.number()])
  .transform((value) => (value === "" ? Number.NaN : value))
  .refine((value) => Number.isFinite(value), "Enter an amount.")
  .refine((value) => value >= 0, "An amount cannot be negative.")
  .refine((value) => value <= 100_000_000, "That amount is implausibly large.")
  .transform((value) => Math.round(value * 100));

/** The same, but optional — a target that has not been set is not zero. */
const optionalAmountInPounds = z
  .union([z.literal(""), z.coerce.number()])
  .transform((value) => (value === "" ? null : value))
  .refine(
    (value) => value === null || (Number.isFinite(value) && value >= 0),
    "An amount cannot be negative.",
  )
  .refine(
    (value) => value === null || value <= 100_000_000,
    "That amount is implausibly large.",
  )
  .transform((value) => (value === null ? null : Math.round(value * 100)));

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");

const optionalIsoDate = z
  .union([z.literal(""), isoDate])
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null);

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .default("")
    .transform((value) => (value === "" ? null : value));

export const expenseStatusValues = ["PENDING", "PAID", "VOID"] as const;
export const expenseCadenceValues = ["MONTHLY", "YEARLY"] as const;
export const expenseGroupValues = [
  "OPERATIONS",
  "PEOPLE",
  "BUSINESS",
  "MARKETING",
  "PRODUCTION",
  "OTHER",
] as const;

/**
 * One expense, and — optionally — the rule that should keep producing it.
 *
 * `repeats` is `none` for a one-time cost. Anything else creates a rule and
 * generates every occurrence from the given date up to today, which is why the
 * form asks for a *start* date rather than a date: for a recurring expense, the
 * day the desk typed is the first of a series.
 */
export const expenseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the expense a name the desk will recognise.")
    .max(120, "That name is too long."),

  categoryId: z
    .string()
    .trim()
    .min(1, "Choose a category.")
    .max(64, "That is not a category."),

  amount: amountInPounds,

  incurredOn: isoDate,

  status: z.enum(expenseStatusValues),

  vendor: optionalText(120, "That supplier name is too long."),
  reference: optionalText(500, "That reference is too long."),
  notes: optionalText(2000, "That note is too long."),

  repeats: z.enum(["none", "MONTHLY", "YEARLY"]).default("none"),
  /** Only read when `repeats` is not `none`. Null is open-ended. */
  endsOn: optionalIsoDate,
});

export type ExpenseInput = z.output<typeof expenseSchema>;

/**
 * Editing a single occurrence.
 *
 * Deliberately narrower than `expenseSchema`: a row that a rule generated may
 * have its amount, date, category, status and notes corrected — a typo is a
 * typo — but it can never be turned into a rule or detached from one from here.
 * That is what the rule's own screen is for.
 */
export const expenseEditSchema = expenseSchema.omit({
  repeats: true,
  endsOn: true,
});

export const expenseRuleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Give the recurring expense a name.")
      .max(120, "That name is too long."),

    categoryId: z
      .string()
      .trim()
      .min(1, "Choose a category.")
      .max(64, "That is not a category."),

    amount: amountInPounds,

    cadence: z.enum(expenseCadenceValues),

    startsOn: isoDate,
    endsOn: optionalIsoDate,

    vendor: optionalText(120, "That supplier name is too long."),
    notes: optionalText(2000, "That note is too long."),

    isActive: z.coerce.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.endsOn && data.endsOn < data.startsOn) {
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "The end cannot come before the start.",
      });
    }

    // The generator refuses to walk back further than this, and a rule it can
    // never fully generate is a rule whose figures would be wrong.
    if (data.startsOn < "2020-01-01") {
      ctx.addIssue({
        code: "custom",
        path: ["startsOn"],
        message: "Recurring expenses cannot start before 2020.",
      });
    }
  });

export type ExpenseRuleInput = z.output<typeof expenseRuleSchema>;

/**
 * One month's targets.
 *
 * `periodMonth` arrives as `YYYY-MM` from a month input and is normalised to
 * the first of that month, which is the only value the column's check accepts.
 * All three amounts are independent and optional — a house may have decided on
 * revenue and not yet on profit.
 */
export const financialTargetSchema = z.object({
  periodMonth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "Pick a month.")
    .transform((value) => `${value}-01`),

  revenueTarget: optionalAmountInPounds,
  grossProfitTarget: optionalAmountInPounds,
  netProfitTarget: optionalAmountInPounds,

  notes: optionalText(2000, "That note is too long."),
});

export type FinancialTargetInput = z.output<typeof financialTargetSchema>;

/**
 * A category.
 *
 * The id is derived from the name by the form and validated here rather than
 * accepted freely: it is a primary key that appears in a URL, and a category
 * called "Rent / Premises" must not become one.
 */
export const expenseCategorySchema = z.object({
  id: z
    .string()
    .trim()
    .min(2, "That name is too short to make an identifier from.")
    .max(64, "That name is too long.")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letters and numbers."),

  name: z
    .string()
    .trim()
    .min(2, "Give the category a name.")
    .max(60, "That name is too long."),

  group: z.enum(expenseGroupValues),

  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export type ExpenseCategoryInput = z.output<typeof expenseCategorySchema>;

/** Renaming an existing category. Its id and group never move. */
export const expenseCategoryRenameSchema = expenseCategorySchema.pick({
  name: true,
  group: true,
  sortOrder: true,
});
