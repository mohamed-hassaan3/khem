/**
 * Offer write validation.
 *
 * The twin of `supabase/sql/0060_offers.sql`'s column checks, plus the three
 * cross-field rules a column check cannot express:
 *
 *  1. a `PERCENTAGE` reward needs a value, and a `FREE_ITEM` must not carry one;
 *  2. an offer gated on a code must be allowed to run beside one;
 *  3. a scope must actually name something — an offer targeting nothing applies
 *     to nothing, which is a campaign nobody will ever notice is broken.
 *
 * (3) has no database twin on purpose: an empty target set is a legitimate
 * intermediate state for a row being assembled by a script or a migration. It is
 * not a legitimate thing to *save from the dashboard*, which is what this is.
 */

import { z } from "zod";

import {
  OFFER_AUDIENCES,
  OFFER_REWARD_KINDS,
  OFFER_SCOPES,
  OFFER_SELECTIONS,
} from "@/src/types/offer";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugList = z
  .array(z.string().trim().regex(SLUG_PATTERN, "That is not a valid slug."))
  .max(200, "That is more targets than a campaign needs.")
  .default([]);

const optionalDate = z
  .union([z.literal(""), z.string().trim()])
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null);

const optionalCount = z
  .union([z.literal(""), z.coerce.number().int().min(1)])
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null);

export const offerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Give the offer a name the desk will recognise.")
      .max(80, "That name is too long."),
    description: z.string().trim().max(300, "That description is too long.").default(""),

    label: z.string().trim().max(60, "That label is too long.").default(""),
    labelAr: z.string().trim().max(60, "That label is too long.").default(""),

    isActive: z.coerce.boolean(),
    startsAt: optionalDate,
    endsAt: optionalDate,

    triggerQuantity: z.coerce
      .number({ error: "How many must they buy?" })
      .int("Whole units only.")
      .min(1, "A trigger of nothing applies to every basket.")
      .max(50, "That is more units than a basket holds."),
    triggerScope: z.enum(OFFER_SCOPES as unknown as [string, ...string[]]),
    triggerProductSlugs: slugList,
    triggerCollectionSlugs: slugList,

    rewardQuantity: z.coerce
      .number({ error: "How many do they receive?" })
      .int("Whole units only.")
      .min(1, "A reward of nothing is not an offer.")
      .max(50, "That is more units than a basket holds."),
    rewardKind: z.enum(OFFER_REWARD_KINDS as unknown as [string, ...string[]]),
    rewardScope: z.enum(OFFER_SCOPES as unknown as [string, ...string[]]),
    rewardSelection: z.enum(OFFER_SELECTIONS as unknown as [string, ...string[]]),
    rewardValue: z
      .union([z.literal(""), z.coerce.number().int().min(1).max(100)])
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null),
    rewardProductSlugs: slugList,
    rewardCollectionSlugs: slugList,

    audience: z.enum(OFFER_AUDIENCES as unknown as [string, ...string[]]),
    requiresCode: z
      .string()
      .trim()
      .max(40, "That code is too long.")
      .transform((value) => (value === "" ? null : value.toUpperCase()))
      .nullable()
      .default(null),

    totalUseLimit: optionalCount,
    perCustomerLimit: optionalCount,

    stacksWithCodes: z.coerce.boolean(),
    stacksWithCredit: z.coerce.boolean(),

    priority: z.coerce.number().int().min(-100).max(100).default(0),
  })
  .refine(
    (data) => data.rewardKind !== "PERCENTAGE" || data.rewardValue !== null,
    {
      path: ["rewardValue"],
      message: "A percentage reward needs a percentage.",
    },
  )
  .refine(
    (data) => data.rewardKind !== "FREE_ITEM" || data.rewardValue === null,
    {
      path: ["rewardValue"],
      message: "A free item has no percentage. Clear this field.",
    },
  )
  .refine((data) => data.requiresCode === null || data.stacksWithCodes, {
    path: ["requiresCode"],
    message:
      "An offer gated on a code must be allowed to run beside one, or it could never apply.",
  })
  .refine(
    (data) =>
      data.triggerScope === "PRODUCTS"
        ? data.triggerProductSlugs.length > 0
        : data.triggerCollectionSlugs.length > 0,
    {
      path: ["triggerProductSlugs"],
      message: "Choose what the customer has to buy.",
    },
  )
  .refine(
    (data) =>
      data.rewardScope === "PRODUCTS"
        ? data.rewardProductSlugs.length > 0
        : data.rewardCollectionSlugs.length > 0,
    {
      path: ["rewardProductSlugs"],
      message: "Choose what the customer receives.",
    },
  )
  .refine(
    (data) =>
      data.startsAt === null ||
      data.endsAt === null ||
      new Date(data.endsAt) > new Date(data.startsAt),
    { path: ["endsAt"], message: "The end must come after the start." },
  );

export type OfferInput = z.input<typeof offerSchema>;
