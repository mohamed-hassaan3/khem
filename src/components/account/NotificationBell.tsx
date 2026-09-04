"use client";

/**
 * The storefront's bell — what the house has told this customer, in the header.
 *
 * ## This reverses an earlier decision, deliberately
 *
 * The account rail used to carry a quiet numeral and the header carried
 * nothing, on the reading that §16's "optional and non-intrusive" forbade a
 * count over a perfume boutique. The house has asked for the bell. What keeps
 * the original concern honest is *who sees it*: it renders *only* for a signed
 * -in visitor, so somebody browsing fragrances still meets no badge, no count
 * and no dot. The rail's numeral is gone, because two places counting the same
 * unread rows is how the two come to disagree.
 *
 * ## It cannot read the session where it renders
 *
 * `<Nav>` is in the layout of every route. Reading `currentUser()` here would
 * turn all thirty routes dynamic — the cost `src/actions/account.ts` documents
 * for `viewerIsAdmin()`, and the reason this component asks the same way: one
 * action for the numeral when it mounts signed-in, one for the list the first
 * time the panel is opened. A visitor who never opens it fetches one integer;
 * a guest fetches nothing.
 *
 * ## Read state is server state
 *
 * Opening a row marks it read through the same action the panel at
 * `/account/notifications` uses, and the list is re-read rather than dimmed in
 * place. A row that looked read in one tab and came back new in the next would
 * teach a customer to distrust the whole feed.
 */

import { Bell, Package, Ticket, Wallet } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  customerNotifications,
  customerUnreadCount,
} from "@/src/actions/account-notifications";
import { markNotificationsRead } from "@/src/actions/notifications";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import {
  notificationHref,
  notificationSentence,
} from "@/src/lib/notification-copy";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";
import type {
  CustomerNotification,
  CustomerNotificationKind,
} from "@/src/types/notification";

const KIND_ICON: Record<CustomerNotificationKind, typeof Bell> = {
  ORDER_STATUS: Package,
  CREDIT_EARNED: Wallet,
  VOUCHER_GRANTED: Ticket,
};

/**
 * How long ago, in the reader's language.
 *
 * `Intl.RelativeTimeFormat` rather than the hand-rolled minutes-and-hours the
 * desk's bell uses: that one is English-only because the desk is, and this
 * header is not. Anything inside the last minute is "just now" — a formatter
 * saying "in 0 seconds" for a notification written a moment ago is worse than
 * the phrase.
 */
function ago(iso: string, locale: Locale, justNow: string): string {
  const seconds = Math.round((Date.parse(iso) - Date.now()) / 1000);
  if (!Number.isFinite(seconds) || Math.abs(seconds) < 60) return justNow;

  const formatter = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-EG" : "en", {
    numeric: "auto",
  });

  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");

  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return formatter.format(days, "day");

  return formatter.format(Math.round(days / 30), "month");
}

export default function NotificationBell() {
  const dict = useDictionary();
  const locale = useLocale();
  const copy = dict.account.bell;

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<readonly CustomerNotification[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement | null>(null);

  /*
   * The numeral, once. The component only mounts for a signed-in visitor — see
   * the branch in `<Nav>` — so there is no signed-out case to guard here, and
   * the action answers 0 for one anyway.
   */
  useEffect(() => {
    let live = true;

    customerUnreadCount()
      .then((count) => {
        if (live) setUnread(count);
      })
      .catch(() => {
        // A header badge is not worth a console full of failures on a flaky
        // connection. No numeral is the honest fallback.
      });

    return () => {
      live = false;
    };
  }, []);

  // Pointerdown, like the account menu beside it: a panel that survives until
  // mouseup reads as one that failed to notice the dismissal.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const node = containerRef.current;
      if (node && !node.contains(event.target as Node)) setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /** Re-read rather than patch: the server's answer is the one that counts. */
  function refresh() {
    startTransition(async () => {
      const feed = await customerNotifications();
      setItems(feed);
      setUnread(feed.filter((item) => !item.isRead).length);
    });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    // Fetched on the first open and re-fetched on every one after: a bell that
    // showed the same list an hour later would be a stale bell.
    if (next) refresh();
  }

  function markRead(rows: readonly CustomerNotification[]) {
    if (rows.length === 0) return;

    startTransition(async () => {
      await markNotificationsRead({
        items: rows.map((item) => ({ kind: item.kind, entityId: item.entityId })),
      });

      const feed = await customerNotifications();
      setItems(feed);
      setUnread(feed.filter((item) => !item.isRead).length);
    });
  }

  const unreadRows = (items ?? []).filter((item) => !item.isRead);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        aria-label={
          unread > 0
            ? interpolate(copy.labelWithCount, { count: String(unread) })
            : copy.label
        }
        className="nav-link relative flex size-[26px] cursor-pointer items-center justify-center"
      >
        <Bell width={17} height={17} strokeWidth={1.25} aria-hidden="true" />

        {unread > 0 ? (
          <span
            aria-hidden="true"
            /* The same gold-on-ivory pill the bag count wears, and for the same
               reason: it must read against the header's ground, not obsidian. */
            className="absolute -end-1 -top-1 grid min-w-4 place-items-center rounded-full bg-ground-accent px-1 font-body text-[9px] leading-4 text-ground-bg"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      <div
        role="dialog"
        aria-label={copy.heading}
        inert={!open}
        className={[
          "absolute end-0 top-[calc(100%+14px)] z-1001 w-[min(92vw,23rem)]",
          "border border-ground-border bg-ground-bg shadow-3",
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-3 border-b border-ground-border px-5 py-3.5">
          <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent">
            {copy.heading}
          </p>

          {unreadRows.length > 0 ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => markRead(unreadRows)}
              className="cursor-pointer bg-transparent p-0 font-heading text-[9px] uppercase tracking-[0.16em] text-ground-muted underline-offset-4 transition-colors duration-300 ease-luxury-bezier hover:text-ground-accent hover:underline disabled:opacity-40"
            >
              {copy.markAll}
            </button>
          ) : null}
        </div>

        <div className="max-h-[24rem] overflow-y-auto">
          {items !== null && items.length === 0 ? (
            <p className="px-5 py-6 text-[11px] leading-relaxed text-ground-muted">
              {copy.empty}
            </p>
          ) : (
            <ul>
              {(items ?? []).map((item) => {
                const Icon = KIND_ICON[item.kind];

                return (
                  <li
                    key={`${item.kind}:${item.entityId}`}
                    className={`border-b border-ground-border last:border-b-0 ${
                      item.isRead ? "" : "bg-gold/6"
                    }`}
                  >
                    {/* Opening it is reading it — the same rule the panel and
                        the desk's bell follow. The action is idempotent, so a
                        second open of a read row writes nothing. */}
                    <LocaleLink
                      href={notificationHref(item)}
                      onClick={() => {
                        setOpen(false);
                        if (!item.isRead) markRead([item]);
                      }}
                      className="flex items-start gap-3 px-5 py-3.5 no-underline"
                    >
                      <Icon
                        size={14}
                        strokeWidth={1.25}
                        aria-hidden="true"
                        className={`mt-0.5 shrink-0 ${
                          item.isRead ? "text-ground-muted/70" : "text-ground-accent"
                        }`}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block font-heading text-[9px] uppercase tracking-[0.18em] text-ground-muted">
                          {dict.account.notifications.kind[item.kind]}
                        </span>

                        {/* `dir="auto"` rather than an island: a translated
                            sentence with a Latin order number inside it takes
                            its base direction from the prose. */}
                        <span
                          dir="auto"
                          className="mt-0.5 block text-[12px] leading-relaxed text-ground"
                        >
                          {notificationSentence(item, dict.account.notifications)}
                        </span>

                        <span className="mt-1 block text-[10px] text-ground-muted/70">
                          {ago(item.occurredAt, locale, copy.justNow)}
                        </span>
                      </span>
                    </LocaleLink>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-ground-border px-5 py-3.5">
          <LocaleLink
            href={ACCOUNT_PATHS.notifications}
            onClick={() => setOpen(false)}
            className="font-heading text-[10px] uppercase tracking-[0.16em] text-ground-accent/80 no-underline underline-offset-4 transition-colors duration-300 ease-luxury-bezier hover:text-ground-accent hover:underline"
          >
            {copy.viewAll}
          </LocaleLink>
        </div>
      </div>
    </div>
  );
}
