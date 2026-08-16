import type { Metadata } from "next";

import AdminShell from "@/src/components/admin/AdminShell";
import { requireAdmin } from "@/src/lib/admin/auth";
import { isLocale } from "@/src/lib/i18n/config";

/**
 * The dashboard shell — and the gate.
 *
 * `requireAdmin()` runs here, once per navigation, so no screen beneath re-asks
 * who the viewer is. What it does **not** do is authorize the writes: every
 * Server Action in `src/actions/admin/` calls `requireAdmin()` again as its
 * first statement, because an action is a public endpoint that can be invoked
 * without ever rendering this layout. See `src/lib/admin/auth.ts`.
 *
 * A non-admin — signed out, or signed in as a customer — gets `notFound()`,
 * not a redirect. A redirect to sign-in would confirm that `/admin` is a real
 * address worth coming back to with different credentials.
 *
 * ## Why this tree is English only
 *
 * Every route lives under `app/[locale]/` because `src/proxy.ts` rewrites
 * unprefixed requests into it — a top-level `app/admin/` would never be
 * reached. But nothing here reads a dictionary. The rule that no English string
 * may appear on an Arabic page protects *customers*; this surface has one
 * reader, who chose the address it lives at.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "KHEM — Boutique Desk",
  // Belt to `robots.ts`'s braces: this tree must not be crawled or indexed.
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, actor] = await Promise.all([params, requireAdmin()]);

  // The parent layout has already rejected any segment that is not a locale.
  const activeLocale = isLocale(locale) ? locale : "en";

  return (
    <AdminShell locale={activeLocale} actorEmail={actor.email}>
      {children}
    </AdminShell>
  );
}
