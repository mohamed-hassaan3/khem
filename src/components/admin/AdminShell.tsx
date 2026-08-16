"use client";

/**
 * The dashboard chrome — rail, header, panel slot.
 *
 * A client component only because the active link needs `usePathname()`. The
 * session was already resolved by the layout above; this receives the actor's
 * email as a prop and never asks who they are, because a component that could
 * answer that question is a component someone will later trust to *decide* it.
 *
 * Hrefs are built with `localizePath` rather than `<LocaleLink>` so the rail
 * does not depend on the i18n provider: the dashboard is English by
 * construction, and building the prefix from the locale the layout already
 * resolved keeps `/ar/admin` navigating within itself instead of throwing an
 * editor into the other tree mid-task.
 */

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ExternalLink, FileText, LayoutGrid, Package, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { localizePath, type Locale } from "@/src/lib/i18n/config";

const SECTIONS = [
  { path: "/admin", label: "Dashboard", icon: LayoutGrid },
  { path: "/admin/collections", label: "Collections", icon: Sparkles },
  { path: "/admin/products", label: "Products", icon: Package },
  { path: "/admin/journal", label: "Journal", icon: FileText },
] as const;

export default function AdminShell({
  locale,
  actorEmail,
  children,
}: {
  locale: Locale;
  actorEmail: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  /** `/admin` is active only on itself; every other section owns its subtree. */
  function isActive(path: string): boolean {
    const href = localizePath(locale, path);
    if (path === "/admin") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen bg-background pt-20 text-ivory lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-20 z-10 border-b border-border bg-surface/70 backdrop-blur-md lg:h-[calc(100vh-5rem)] lg:overflow-y-auto lg:border-b-0 lg:border-e lg:bg-surface lg:py-12 lg:backdrop-blur-none">
        <div className="hidden px-8 lg:block">
          <p className="font-heading text-[11px] uppercase tracking-[0.3em] text-gold">
            KHEM
          </p>
          <p className="mt-1 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/30">
            Boutique Desk
          </p>
        </div>

        {/*
          Below `lg` the rail becomes a horizontal strip that scrolls rather
          than wrapping: four items wrapping to two rows pushes the panel down
          the page on every screen.
        */}
        <nav className="flex gap-1 overflow-x-auto px-4 py-3 lg:mt-10 lg:flex-col lg:px-4 lg:py-0">
          {SECTIONS.map((section) => {
            const active = isActive(section.path);
            const Icon = section.icon;

            return (
              <Link
                key={section.path}
                href={localizePath(locale, section.path)}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 border-s-2 px-4 py-3 font-heading text-[10px] uppercase tracking-[0.2em] transition-colors duration-300 ${
                  active
                    ? "border-gold bg-gold/5 text-gold"
                    : "border-transparent text-ivory/40 hover:text-ivory"
                }`}
              >
                <Icon size={14} strokeWidth={1.25} />
                {section.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden border-t border-border px-8 pt-6 lg:mt-10 lg:block">
          <p className="font-heading text-[9px] uppercase tracking-[0.2em] text-ivory/25">
            Signed in as
          </p>
          <p className="mt-1 break-all text-[11px] text-ivory/50">{actorEmail}</p>

          <Link
            href={localizePath(locale, "/")}
            className="mt-5 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-ivory/35 transition-colors duration-300 hover:text-gold"
          >
            <ExternalLink size={12} strokeWidth={1.25} />
            View storefront
          </Link>
        </div>
      </aside>

      <main className="px-5 pb-24 pt-10 sm:px-8 lg:px-14 lg:pt-14">{children}</main>
    </div>
  );
}
