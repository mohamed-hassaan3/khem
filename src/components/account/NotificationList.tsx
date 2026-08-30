"use client";

import { Bell, Package, Ticket, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

import { markNotificationsRead } from "@/src/actions/notifications";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import Price from "@/src/components/ecommerce/Price";
import { formatAccountDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import type {
  CustomerNotification,
  CustomerNotificationKind,
} from "@/src/types/notification";

/**
 * What the house has told this customer, newest first.
 *
 * ## Nothing here is a second record
 *
 * Every line is a row that already existed — a station on an order's rail, a
 * credit earned, a voucher granted. The panel reads them and remembers only
 * which ones have been dismissed, which is the same discipline the ledger, the
 * discount engine and the desk's own bell already follow.
 *
 * ## Read state is server state
 *
 * Marking read posts to an action and refreshes, rather than dimming the row
 * locally. A row that looked read in one tab and came back new in the next would
 * teach a customer to distrust the whole panel.
 *
 * ## Worded as a journey, not as a status
 *
 * `ORDER_STATUS` carries a raw `OrderStatus` from the database, and the customer
 * reads "is on its way", never "SHIPPED" — the same treatment `OrderTracker`
 * gives the rail, so one order does not describe itself two ways on two screens.
 */

const KIND_ICON: Record<CustomerNotificationKind, typeof Bell> = {
  ORDER_STATUS: Package,
  CREDIT_EARNED: Wallet,
  VOUCHER_GRANTED: Ticket,
};

type Copy = Dictionary["account"]["notifications"];

/** Where a notification leads — always to the customer's own screen. */
function hrefFor(item: CustomerNotification): string {
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
function sentence(item: CustomerNotification, copy: Copy): string {
  if (item.kind === "ORDER_STATUS") {
    const status = item.detail as keyof Copy["status"] | null;
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

export default function NotificationList({
  notifications,
  locale,
  copy,
}: {
  notifications: readonly CustomerNotification[];
  locale: Locale;
  copy: Copy;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const unread = notifications.filter((item) => !item.isRead);

  const markRead = useCallback(
    (items: readonly CustomerNotification[]) => {
      if (items.length === 0) return;

      startTransition(async () => {
        await markNotificationsRead({
          items: items.map((item) => ({ kind: item.kind, entityId: item.entityId })),
        });
        router.refresh();
      });
    },
    [router],
  );

  return (
    <div>
      {unread.length > 0 ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="font-heading text-[11px] tracking-[0.14em] text-ground-accent">
            {unread.length === 1
              ? copy.unreadOne
              : interpolate(copy.unread, { count: String(unread.length) })}
          </p>

          <button
            type="button"
            disabled={isPending}
            onClick={() => markRead(unread)}
            className="cursor-pointer bg-transparent p-0 font-heading text-[10px] uppercase tracking-[0.16em] text-ground-muted underline-offset-4 transition-colors duration-300 ease-luxury-bezier hover:text-ground-accent hover:underline disabled:opacity-40"
          >
            {copy.markAll}
          </button>
        </div>
      ) : null}

      <ul className="flex flex-col gap-px">
        {notifications.map((item) => {
          const Icon = KIND_ICON[item.kind];

          return (
            <li
              key={`${item.kind}:${item.entityId}`}
              className={`flex items-start gap-4 border-s-2 px-5 py-5 transition-colors duration-500 ease-luxury-bezier ${
                item.isRead
                  ? "border-transparent bg-stone"
                  : "border-gold bg-gold/6"
              }`}
            >
              <Icon
                size={15}
                strokeWidth={1.25}
                aria-hidden="true"
                className={`mt-0.5 shrink-0 ${
                  item.isRead ? "text-ground-muted/70" : "text-ground-accent"
                }`}
              />

              <div className="min-w-0 flex-1">
                <p className="mb-1 font-heading text-[10px] uppercase tracking-[0.18em] text-ground-muted">
                  {copy.kind[item.kind]}
                </p>

                {/*
                  * `dir="auto"` rather than an LTR island: a translated sentence
                  * with a Latin order number inside it takes its base direction
                  * from the prose while the number keeps its own run.
                  */}
                <p className="text-[13px] leading-relaxed text-ground" dir="auto">
                  {sentence(item, copy)}
                </p>

                {item.amountInCents !== null ? (
                  <p className="mt-1 font-heading text-[13px] text-ground-accent">
                    <Price cents={item.amountInCents} />
                  </p>
                ) : null}

                <div className="mt-2.5 flex flex-wrap items-center gap-4">
                  <span
                    {...ltrIsland(locale)}
                    className="text-[11px] text-ground-muted/70"
                  >
                    {formatAccountDate(item.occurredAt, locale)}
                  </span>

                  <LocaleLink
                    href={hrefFor(item)}
                    className="font-heading text-[10px] uppercase tracking-[0.16em] text-ground-accent/70 no-underline underline-offset-4 transition-colors duration-300 ease-luxury-bezier hover:text-ground-accent hover:underline"
                  >
                    {copy.view}
                  </LocaleLink>

                  {item.isRead ? null : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => markRead([item])}
                      className="cursor-pointer bg-transparent p-0 text-[10px] tracking-wide text-ground-muted/70 underline-offset-4 transition-colors duration-300 ease-luxury-bezier hover:text-ground-accent hover:underline disabled:opacity-40"
                    >
                      {copy.markOne}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
