/**
 * How a customer notification reads, and where it leads.
 *
 * Both surfaces that render the feed — the panel at `/account/notifications`
 * and the header bell — need exactly these two answers, and they must agree:
 * one order described as "on its way" in the bell and "SHIPPED" on the page
 * would be the same fact told two ways in one session.
 *
 * Copy only. Nothing here reads the session, touches the database, or decides
 * what a customer may see; `src/services/notifications.ts` has already done
 * that by the time a row reaches either component.
 */

import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import type { CustomerNotification } from "@/src/types/notification";

export type NotificationCopy = Dictionary["account"]["notifications"];

/** Where a notification leads — always to the customer's own screen. */
export function notificationHref(item: CustomerNotification): string {
  switch (item.kind) {
    case "ORDER_STATUS":
      // The orders panel anchors each card by its number.
      return `${ACCOUNT_PATHS.orders}#${item.label}`;
    case "CREDIT_EARNED":
    case "VOUCHER_GRANTED":
      return ACCOUNT_PATHS.vouchers;
    default: {
      const unreachable: never = item.kind;
      return unreachable;
    }
  }
}

/** The sentence a customer reads. Never a raw status, never a bare code. */
export function notificationSentence(
  item: CustomerNotification,
  copy: NotificationCopy,
): string {
  if (item.kind === "ORDER_STATUS") {
    const status = item.detail as keyof NotificationCopy["status"] | null;
    const template = status && status in copy.status ? copy.status[status] : null;
    return template
      ? interpolate(template, { order: item.label })
      : copy.kind.ORDER_STATUS;
  }

  if (item.kind === "CREDIT_EARNED") {
    return item.label
      ? interpolate(copy.creditEarned, { order: item.label })
      : copy.creditEarnedPlain;
  }

  return interpolate(copy.voucherGranted, { code: item.label });
}
