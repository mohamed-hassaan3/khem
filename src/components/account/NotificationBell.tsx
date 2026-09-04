"use client";

/**
 * The portal's bell — what the house has told this customer, above the panel.
 *
 * ## Where it lives, and why that is not the storefront header
 *
 * Inside the account, and only inside the account. §16 asks for optional and
 * non-intrusive, and a notification count over a perfume boutique is neither:
 * somebody browsing fragrances meets no badge, no dot and no numeral. Somebody
 * who has come to their account meets it at the top of every panel. It replaced
 * the quiet numeral the navigation rail used to carry — one place counting
 * unread rows, never two that can disagree.
 *
 * ## Server data, not a fetch on mount
 *
 * The feed arrives as a prop. The layout that renders this has already read the
 * session and the rows — `notificationsForUser()` is memoised per request, so
 * the panel at `/account/notifications` beneath it shares the same read rather
 * than running the feed twice — and every account route is `force-dynamic`, so
 * a navigation is a fresh list. No Server Action of its own, nothing fetched in
 * an effect, and no moment where the bell is mounted but empty.
 *
 * ## Read state is server state
 *
 * Opening a row marks it read through the same action the panel uses, then
 * refreshes. A row that looked read in one tab and came back new in the next
 * would teach a customer to distrust the whole feed.
 */

import { Bell, Package, Ticket, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { markNotificationsRead } from "@/src/actions/notifications";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { interpolate } from "@/src/lib/i18n/interpolate";
import {
  notificationHref,
  notificationSentence,
} from "@/src/lib/notification-copy";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
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
 * desk's bell uses: that one is English-only because the desk is, and the
 * storefront is not. Anything inside the last minute is "just now" — a
 * formatter saying "in 0 seconds" for something written a moment ago is worse
 * than the phrase.
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

export interface NotificationBellProps {
  notifications: readonly CustomerNotification[];
  locale: Locale;
  copy: Dictionary["account"]["bell"];
  /** The kinds and sentences, shared with the panel at `/account/notifications`. */
  feedCopy: Dictionary["account"]["notifications"];
}

export default function NotificationBell({
  notifications,
  locale,
  copy,
  feedCopy,
}: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const unread = notifications.filter((item) => !item.isRead);

  // Pointerdown, like the account menu: a panel that survives until mouseup
  // reads as one that failed to notice the dismissal.
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

  function markRead(rows: readonly CustomerNotification[]) {
    if (rows.length === 0) return;

    startTransition(async () => {
      await markNotificationsRead({
        items: rows.map((item) => ({ kind: item.kind, entityId: item.entityId })),
      });
      // The layout re-renders and hands down a fresh feed; nothing is dimmed
      // locally, so the numeral and the database never disagree.
      router.refresh();
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        aria-label={
          unread.length > 0
            ? interpolate(copy.labelWithCount, { count: String(unread.length) })
            : copy.label
        }
        className="relative flex size-9 cursor-pointer items-center justify-center border border-ground-border bg-transparent text-ground-muted transition-colors duration-300 ease-luxury-bezier hover:border-gold/40 hover:text-ground-accent"
      >
        <Bell size={16} strokeWidth={1.25} aria-hidden="true" />

        {unread.length > 0 ? (
          <span
            aria-hidden="true"
            /* Deep gold on the panel's ivory ground, like the bag count in the
               header: legible without shouting, and inside the 5% accent. */
            className="absolute -end-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-ground-accent px-1 font-body text-[9px] leading-4 text-ground-bg"
          >
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        ) : null}
      </button>

      <div
        role="dialog"
        aria-label={copy.heading}
        inert={!open}
        className={[
          "absolute end-0 top-[calc(100%+10px)] z-1001 w-[min(88vw,23rem)]",
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

          {unread.length > 0 ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => markRead(unread)}
              className="cursor-pointer bg-transparent p-0 font-heading text-[9px] uppercase tracking-[0.16em] text-ground-muted underline-offset-4 transition-colors duration-300 ease-luxury-bezier hover:text-ground-accent hover:underline disabled:opacity-40"
            >
              {copy.markAll}
            </button>
          ) : null}
        </div>

        <div className="max-h-[24rem] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-5 py-6 text-[11px] leading-relaxed text-ground-muted">
              {copy.empty}
            </p>
          ) : (
            <ul>
              {notifications.map((item) => {
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
                          {feedCopy.kind[item.kind]}
                        </span>

                        {/* `dir="auto"` rather than an island: a translated
                            sentence with a Latin order number inside it takes
                            its base direction from the prose. */}
                        <span
                          dir="auto"
                          className="mt-0.5 block text-[12px] leading-relaxed text-ground"
                        >
                          {notificationSentence(item, feedCopy)}
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
