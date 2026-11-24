import "server-only";

import { Bell } from "lucide-react";

import NotificationBell from "@/src/components/admin/NotificationBell";
import type { Locale } from "@/src/lib/i18n/config";
import {
  listAdminNotifications,
  listLowStock,
} from "@/src/services/admin/notifications";

/**
 * The bell, with its own data — streamed.
 *
 * The admin layout used to await these two reads before it could paint
 * anything, so every full load of every admin screen waited on the feed. Here
 * they run inside a `<Suspense>` the layout places in the header: the page
 * paints at once and the bell fills in when its reads land.
 *
 * Still only ever rendered by `admin/layout.tsx` *after* `requireAdmin()` has
 * passed — the element is created below the gate — so a refused request never
 * runs either read. Both are secret-key reads of rows that name customers.
 */
export default async function AdminBell({ locale }: { locale: Locale }) {
  const [notifications, lowStock] = await Promise.all([
    listAdminNotifications(),
    listLowStock(),
  ]);

  return <NotificationBell notifications={notifications} lowStock={lowStock} locale={locale} />;
}

/**
 * What stands in the header while the bell's reads are in flight: the same
 * button, same size, without a count — so nothing shifts when it arrives.
 */
export function AdminBellPlaceholder() {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="relative inline-flex items-center justify-center border border-ground-border px-3 py-2 text-ground-muted"
      >
        <Bell size={15} strokeWidth={1.25} />
      </span>
    </div>
  );
}
