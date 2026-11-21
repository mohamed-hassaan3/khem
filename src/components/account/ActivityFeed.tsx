"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

import { markNotificationsRead } from "@/src/actions/notifications";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { formatAccountDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import {
  notificationHref,
  notificationSentence,
  type NotificationCopy,
} from "@/src/lib/notification-copy";
import type { CustomerNotification } from "@/src/types/notification";

/**
 * Home's "Recent activity" — the newest few notifications, as quiet rows.
 *
 * The same feed the bell and `/account/notifications` read, worded by the same
 * `notificationSentence()`, linked by the same `notificationHref()`. Opening a
 * row marks it read, exactly as the bell does, then refreshes so the dot and
 * the bell's count agree. A gold dot marks the unread; read rows go muted.
 */
export interface ActivityFeedProps {
  items: readonly CustomerNotification[];
  locale: Locale;
  copy: NotificationCopy;
  empty: string;
}

export default function ActivityFeed({ items, locale, copy, empty }: ActivityFeedProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const markRead = useCallback(
    (item: CustomerNotification) => {
      startTransition(async () => {
        await markNotificationsRead({
          items: [{ kind: item.kind, entityId: item.entityId }],
        });
        router.refresh();
      });
    },
    [router],
  );

  if (items.length === 0) {
    return (
      // On desktop the section wraps this in its own framed card, so the line
      // carries the hairlines only on phones.
      <p className="border-y border-ground-border py-5 text-[12px] text-ground-muted lg:border-0 lg:py-3">
        {empty}
      </p>
    );
  }

  return (
    <ul className="border-b border-ground-border lg:border-b-0">
      {items.map((item) => (
        <li key={`${item.kind}:${item.entityId}`} className="border-t border-ground-border first:lg:border-t-0">
          <LocaleLink
            href={notificationHref(item)}
            onClick={() => {
              if (!item.isRead) markRead(item);
            }}
            className="group flex items-start gap-3 py-3 no-underline"
          >
            <span
              aria-hidden="true"
              className={[
                "mt-1.5 size-[7px] shrink-0 rounded-full",
                item.isRead ? "border border-ground-border" : "bg-ground-accent",
              ].join(" ")}
            />
            <span className="min-w-0 flex-1">
              <span
                dir="auto"
                className={[
                  "block text-[13px] leading-snug transition-colors duration-300 group-hover:text-ground-accent",
                  item.isRead ? "text-ground-muted" : "text-ground",
                ].join(" ")}
              >
                {notificationSentence(item, copy)}
              </span>
              <span {...ltrIsland(locale)} className="mt-1 block text-[11px] text-ground-muted rtl:text-right">
                {formatAccountDate(item.occurredAt, locale)}
              </span>
            </span>
          </LocaleLink>
        </li>
      ))}
    </ul>
  );
}
