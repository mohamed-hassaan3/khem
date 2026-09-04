import "server-only";

/**
 * What delivery costs, read from `"DeliverySetting"`.
 *
 * ## The fallback is load-bearing
 *
 * Same shape and same reasoning as `getBoutiqueSettings()` next door. A failed
 * read returns {@link DEFAULT_DELIVERY_TERMS} rather than throwing or returning
 * nothing, because every caller is about to print a total: a cart page that
 * cannot say what delivery costs is worse than one quoting the terms as they
 * stood at the last deploy, and a checkout that priced delivery at zero on a
 * database hiccup would be worse still.
 *
 * ## Read with the public key
 *
 * These figures are printed on the cart page and on every product page. There is
 * nothing here the `anon` role may not see, and `0053_delivery_terms.sql` grants
 * it `select` deliberately — so this uses the same client the storefront's other
 * public reads use, and no secret is needed to price a bag.
 */

import { DEFAULT_DELIVERY_TERMS, type DeliveryTerms } from "@/src/lib/cart";
import { getSupabasePublic } from "@/src/lib/supabase";
import {
  DELIVERY_SETTING_COLUMNS,
  toDeliverySetting,
  type DeliveryChannel,
} from "@/src/schemas/db/delivery";

/**
 * The terms in force on one channel.
 *
 * `ONLINE` for anything a visitor is looking at; `OFFLINE` for the order desk.
 * The channel is a column value, not a filter the caller composes, so there is
 * no way to ask for terms that do not exist.
 */
export async function getDeliveryTerms(
  channel: DeliveryChannel,
): Promise<DeliveryTerms> {
  const supabase = getSupabasePublic();
  if (!supabase) return DEFAULT_DELIVERY_TERMS;

  const { data, error } = await supabase
    .from("DeliverySetting")
    .select(DELIVERY_SETTING_COLUMNS)
    .eq("channel", channel)
    .maybeSingle();

  if (error) {
    console.error(`[delivery] getDeliveryTerms(${channel}) failed: ${error.message}`);
    return DEFAULT_DELIVERY_TERMS;
  }

  const row = toDeliverySetting(data);
  if (row === null) return DEFAULT_DELIVERY_TERMS;

  return {
    feeInCents: row.feeInCents,
    freeThresholdInCents: row.freeThresholdInCents,
  };
}
