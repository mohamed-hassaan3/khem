"use client";

import { Bell, Package, PackageX, Ticket, UserPlus, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import AdminLink from "@/src/components/admin/AdminLink";
import { markNotificationsRead } from "@/src/actions/admin/notifications";
import { egp } from "@/src/lib/admin/money";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import type {
  AdminNotification,
  AdminNotificationKind,
  LowStockItem,
} from "@/src/types/notification";

/**
 * The desk's bell: what happened, and what is running out.
 *
 * ## Two sections, because they are two different things
 *
 * **Events** — an order arrived, an account was opened, a voucher was used, a
 * credit was earned. Each happened at a moment, each can be read, and each links
 * to the screen that deals with it.
 *
 * **Low stock** — a standing condition. It is not dismissible and has no read
 * state, because a product that goes low, is restocked and goes low again would
 * otherwise be hidden the second time by a click from the first. It clears when
 * the shelf is refilled, which is the only thing that should clear it.
 *
 * ## Read state is server state
 *
 * Marking read posts to an action and lets the layout re-render, rather than
 * hiding the dot locally. A count that fell in one tab while the row stayed
 * unread in the database would be a lie the next reload corrects — and the desk
 * would learn not to trust the number.
 */

const KIND_ICON: Record<AdminNotificationKind, typeof Bell> = {
  ORDER: Package,
  CUSTOMER: UserPlus,
  VOUCHER: Ticket,
  CREDIT: Wallet,
};

/** What each kind is called, in the desk's language. */
const KIND_LABEL: Record<AdminNotificationKind, string> = {
  ORDER: "New order",
  CUSTOMER: "New customer",
  VOUCHER: "Voucher used",
  CREDIT: "Credit earned",
};

/**
 * Where a notification leads.
 *
 * `CUSTOMER` deliberately lands on the directory rather than a customer's own
 * screen: that route is keyed by the directory's identifier, and the feed
 * carries a Clerk id. Sending somebody to a 404 is worse than sending them to
 * the list their new customer is at the top of.
 */
function hrefFor(item: AdminNotification, locale: Locale): string {
  switch (item.kind) {
    case "ORDER":
      return localizePath(locale, `/admin/orders/${item.label}`);
    case "VOUCHER":
      return localizePath(locale, `/admin/discounts/${item.label}`);
    case "CREDIT":
      return localizePath(locale, `/admin/credits/${item.entityId}`);
    case "CUSTOMER":
      return localizePath(locale, "/admin/customers");
    default: {
      const unreachable: never = item.kind;
      return unreachable;
    }
  }
}

function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  return `${Math.round(hours / 24)} d ago`;
}

export default function NotificationBell({
  notifications,
  lowStock,
  locale,
}: {
  notifications: readonly AdminNotification[];
  lowStock: readonly LowStockItem[];
  locale: Locale;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const unread = notifications.filter((item) => !item.isRead);

  // Pointerdown, like the storefront's account menu: a panel that survives until
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

  const markRead = useCallback(
    (items: readonly AdminNotification[]) => {
      if (items.length === 0) return;

      startTransition(async () => {
        await markNotificationsRead({
          items: items.map((item) => ({ kind: item.kind, entityId: item.entityId })),
        });
        // The action revalidates the admin layout; this is what pulls the fresh
        // feed into the tree the panel is rendered from.
        router.refresh();
      });
    },
    [router],
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          unread.length > 0
            ? `Notifications, ${unread.length} unread`
            : "Notifications"
        }
        onClick={() => setOpen((current) => !current)}
        className="relative inline-flex items-center justify-center border border-border px-3 py-2 text-ivory/45 transition-colors duration-300 hover:border-gold/40 hover:text-gold"
      >
        <Bell size={15} strokeWidth={1.25} />

        {unread.length > 0 ? (
          <span className="absolute -end-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 font-heading text-[9px] tabular-nums text-background">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        ) : null}
      </button>

      <div
        role="dialog"
        aria-label="Notifications"
        inert={!open}
        className={[
          "absolute end-0 top-[calc(100%+10px)] z-1001 w-[min(92vw,24rem)]",
          "border border-border bg-surface/97 backdrop-blur-xl shadow-[var(--shadow-luxury)]",
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-gold">
            Notifications
          </p>

          {unread.length > 0 ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => markRead(unread)}
              className="cursor-pointer bg-transparent p-0 font-heading text-[9px] uppercase tracking-[0.16em] text-ivory/35 underline-offset-4 transition-colors duration-300 hover:text-gold hover:underline disabled:opacity-40"
            >
              Mark all as read
            </button>
          ) : null}
        </div>

        <div className="max-h-[26rem] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-[11px] text-ivory/30">
              Nothing yet. Orders, accounts and redemptions appear here as they
              happen.
            </p>
          ) : (
            <ul>
              {notifications.map((item) => {
                const Icon = KIND_ICON[item.kind];

                return (
                  <li
                    key={`${item.kind}:${item.entityId}`}
                    className={`border-b border-border last:border-b-0 ${
                      item.isRead ? "" : "bg-gold/4"
                    }`}
                  >
                    <div className="flex items-start gap-3 px-4 py-3">
                      <Icon
                        size={14}
                        strokeWidth={1.25}
                        aria-hidden="true"
                        className={`mt-0.5 shrink-0 ${
                          item.isRead ? "text-ivory/25" : "text-gold"
                        }`}
                      />

                      <div className="min-w-0 flex-1">
                        <AdminLink
                          href={hrefFor(item, locale)}
                          onClick={() => setOpen(false)}
                          className="block no-underline"
                        >
                          <span className="block font-heading text-[10px] uppercase tracking-[0.16em] text-ivory/40">
                            {KIND_LABEL[item.kind]}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-ivory">
                            {item.label}
                            {item.amountInCents !== null ? (
                              <span className="text-ivory/40">
                                {" · "}
                                {egp(item.amountInCents)}
                              </span>
                            ) : null}
                          </span>
                          {item.detail ? (
                            <span className="mt-0.5 block truncate text-[11px] text-ivory/30">
                              {item.detail}
                            </span>
                          ) : null}
                        </AdminLink>

                        <div className="mt-1.5 flex items-center gap-3">
                          <span className="text-[10px] text-ivory/25">
                            {ago(item.occurredAt)}
                          </span>

                          {item.isRead ? null : (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => markRead([item])}
                              className="cursor-pointer bg-transparent p-0 text-[10px] tracking-wide text-ivory/30 underline-offset-4 transition-colors duration-300 hover:text-gold hover:underline disabled:opacity-40"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/*
          * Low stock, beneath the events and visibly not one of them: no read
          * control, no timestamp. It is true until the shelf says otherwise.
          */}
        {lowStock.length > 0 ? (
          <div className="border-t border-border bg-background/40 px-4 py-3">
            <p className="mb-2 flex items-center gap-2 font-heading text-[9px] uppercase tracking-[0.18em] text-warning">
              <PackageX size={12} strokeWidth={1.25} aria-hidden="true" />
              Running low
            </p>

            <ul className="flex flex-col gap-1.5">
              {lowStock.map((item) => (
                <li key={item.slug}>
                  <AdminLink
                    href={localizePath(locale, `/admin/products/${item.slug}`)}
                    onClick={() => setOpen(false)}
                    className="flex items-baseline justify-between gap-3 text-[11px] text-ivory/50 no-underline transition-colors duration-300 hover:text-gold"
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="shrink-0 tabular-nums text-ivory/30">
                      {item.inventory} left
                    </span>
                  </AdminLink>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
