/**
 * The shape `resolve_discount()` answers with.
 *
 * Parsed rather than asserted, like every other row in this folder — and here
 * the discipline earns more than usual: this value decides what a customer is
 * told they will save, and an unparsed `any` from an RPC is the one place a
 * malformed reply could become a number on the page.
 *
 * A refusal this build does not recognise degrades to `UNKNOWN` carrying the
 * English sentence, rather than being dropped. The customer is always told
 * something true; at worst it is told in English on the Arabic tree.
 *
 * The same tolerance governs the `detail` object `0040` attaches: a detail that
 * does not parse is **dropped**, never allowed to invalidate the reply that
 * carries it. Losing the minimum figure costs the customer a vaguer sentence;
 * losing the whole reply would cost them the reason.
 */

import { z } from "zod";

import type {
  DiscountPreview,
  DiscountRefusalDetail,
} from "@/src/types/discount";

/**
 * Exported because the payment button needs the same narrowing: `place_order()`
 * now raises with `DISCOUNT:<reasonCode>` in the exception hint, and
 * `src/actions/checkout.ts` must decide whether that name is one this build
 * knows before it promises the client a translation for it.
 */
export const discountRefusalCodeSchema = z.enum([
  "NO_CODE",
  "NOT_RECOGNISED",
  "INACTIVE",
  "NOT_STARTED",
  "EXPIRED",
  "BELOW_MINIMUM",
  "NOT_GRANTED",
  "ALREADY_USED",
  "FULLY_REDEEMED",
  "CUSTOMER_LIMIT",
  "NOTHING_ELIGIBLE",
  "ZERO_AMOUNT",
]);

/**
 * The specifics, parsed on its own so a failure here cannot take the refusal
 * with it — see `toDiscountPreview` below, which parses it separately and
 * silently discards what does not fit.
 *
 * Every field is optional: a grant-gated code carries none of them, and a
 * database that has not applied `0040` carries no detail at all.
 */
const detailSchema = z.object({
  minimumInCents: z.coerce.number().int().nonnegative().optional(),
  scope: z.enum(["PRODUCTS", "COLLECTIONS"]).optional(),
  names: z
    .array(
      z.object({
        name: z.string().min(1),
        nameAr: z.string().nullish(),
      }),
    )
    .optional(),
  more: z.coerce.number().int().nonnegative().optional(),
});

/** Named here rather than inlined, so the cap has one place to be read. */
const MAX_NAMES = 3;

const previewSchema = z.union([
  z.object({
    ok: z.literal(true),
    code: z.string(),
    amountInCents: z.coerce.number().int().positive(),
  }),
  z.object({
    ok: z.literal(false),
    // A plain string here, narrowed below. Parsing it as the enum would make a
    // reason code from a newer migration invalidate the whole reply and lose
    // the sentence with it — the one thing that is always safe to show.
    reasonCode: z.string().default(""),
    reason: z.string().default(""),
    // Passed through unparsed and handled separately, for the same reason.
    detail: z.unknown().optional(),
  }),
]);

/**
 * The detail, or nothing.
 *
 * Trimmed to {@link MAX_NAMES} here rather than refused above it: a payload
 * naming four collections is a migration that grew its limit, not a malformed
 * reply, and the right answer is to show three of them.
 */
function toRefusalDetail(value: unknown): DiscountRefusalDetail | undefined {
  if (value === undefined || value === null) return undefined;

  const parsed = detailSchema.safeParse(value);
  if (!parsed.success) return undefined;

  const { minimumInCents, scope, names, more } = parsed.data;

  const detail: DiscountRefusalDetail = {
    ...(minimumInCents === undefined ? {} : { minimumInCents }),
    ...(scope === undefined ? {} : { scope }),
    ...(names === undefined
      ? {}
      : {
          names: names.slice(0, MAX_NAMES).map((entry) => ({
            name: entry.name,
            nameAr: entry.nameAr ?? null,
          })),
        }),
    ...(more === undefined ? {} : { more }),
  };

  // An object with nothing in it says less than no object at all.
  return Object.keys(detail).length === 0 ? undefined : detail;
}

export function toDiscountPreview(value: unknown): DiscountPreview | null {
  const parsed = previewSchema.safeParse(value);
  if (!parsed.success) return null;

  if (parsed.data.ok) {
    return {
      ok: true,
      code: parsed.data.code,
      amountInCents: parsed.data.amountInCents,
    };
  }

  const named = discountRefusalCodeSchema.safeParse(parsed.data.reasonCode);
  const detail = toRefusalDetail(parsed.data.detail);

  return {
    ok: false,
    reasonCode: named.success ? named.data : "UNKNOWN",
    reason: parsed.data.reason,
    ...(detail === undefined ? {} : { detail }),
  };
}
