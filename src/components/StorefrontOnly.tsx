"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { stripLocale } from "@/src/lib/i18n/config";

/**
 * Renders the storefront's chrome — announcement bar, header, footer, bag
 * drawer, cookie banner and offer pop-up — everywhere except the admin desk.
 *
 * The `[locale]` layout is a Server Component that cannot see the URL, and
 * reading request headers there would make every storefront page dynamic. This
 * wrapper reads the path on the client (and during SSR, where `usePathname()`
 * is available), so the shop keeps its static rendering and `/admin` gets a
 * shell of its own (`AdminShell`), with no marquee, mega-menu, footer or
 * sign-up pop-up over a working screen (prompts/admin-redesign-stage-6.md).
 *
 * Server Components passed as `children` still render on the server; this only
 * decides whether they are placed.
 */
export default function StorefrontOnly({ children }: { children: ReactNode }) {
  const { path } = stripLocale(usePathname());
  if (path === "/admin" || path.startsWith("/admin/")) return null;
  return children;
}
