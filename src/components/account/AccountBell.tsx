import NotificationBell from "@/src/components/account/NotificationBell";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { notificationsForUser } from "@/src/services/notifications";
import type { Viewer } from "@/src/types/account";

/**
 * The notification bell, as an account panel header's action.
 *
 * It used to sit in the layout, above every panel, in a row of its own. In the
 * redesign it belongs to the title row, so each panel places it — and this
 * wrapper is what keeps that a one-liner. The feed is a secret-key query and
 * the bell is a Client Component, so the read stays here on the server.
 *
 * `notificationsForUser()` is memoised per request: Home places the bell *and*
 * renders the activity feed from the same rows, and that is still one query.
 */
export default async function AccountBell({
  viewer,
  locale,
  dict,
}: {
  viewer: Viewer;
  locale: Locale;
  dict: Dictionary;
}) {
  const notifications = await notificationsForUser({
    clerkUserId: viewer.id,
    email: viewer.primaryEmail,
  });

  return (
    <NotificationBell
      notifications={notifications}
      locale={locale}
      copy={dict.account.bell}
      feedCopy={dict.account.notifications}
    />
  );
}
