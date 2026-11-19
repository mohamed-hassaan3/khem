import type { ReactNode } from "react";

import KhemClerkProvider from "@/src/components/auth/KhemClerkProvider";
import { isLocale } from "@/src/lib/i18n/config";

/**
 * The full Clerk provider for `/sign-in` — it renders Clerk's own form.
 * Public pages load Clerk only for signed-in visitors
 * (prompts/clerk-load-only-where-needed.md).
 */
export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <KhemClerkProvider locale={isLocale(locale) ? locale : "en"}>{children}</KhemClerkProvider>
  );
}
