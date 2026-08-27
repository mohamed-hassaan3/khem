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
 *
 * ## One rail, two behaviours
 *
 * The rail is on the inline-start edge at every width. Below `lg` it is an
 * off-canvas drawer over a scrim — it used to become a horizontal scrolling
 * strip, which is neither a sidebar nor dismissible. At `lg` and up it is a
 * column that the same toggle collapses, and collapsing *removes* it from the
 * grid rather than animating its width: the panel holds a chart, and a column
 * that reflows for 500ms makes the chart re-measure every frame of it.
 *
 * The open state is read from `localStorage` in an effect, never during render.
 * Until that effect runs, `open` is `null` and the rail falls back to its CSS
 * default — hidden below `lg`, shown above it — so the server's markup and the
 * first client render agree and the common case never flashes.
 */

import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ExternalLink,
  FileText,
  LayoutList,
  LayoutGrid,
  Package,
  PanelLeft,
  PanelLeftClose,
  Mail,
  MapPin,
  Tag,
  Ticket,
  Receipt,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import AdminLink from "@/src/components/admin/AdminLink";
import AdminToaster from "@/src/components/admin/AdminToaster";
import NotificationBell from "@/src/components/admin/NotificationBell";
import UnsavedChangesDialog from "@/src/components/admin/UnsavedChangesDialog";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { AdminToastProvider } from "@/src/providers/admin-toast-provider";
import { UnsavedChangesProvider } from "@/src/providers/unsaved-changes-provider";
import type { AdminNotification, LowStockItem } from "@/src/types/notification";

/**
 * Trade first, then the catalog behind it.
 *
 * Orders and inventory are what a desk opens the dashboard for on a normal
 * day; collections and the journal are edited occasionally. The rail is
 * ordered by how often each is reached for, not by how the tables relate.
 */
const SECTIONS = [
  { path: "/admin", label: "Dashboard", icon: LayoutGrid },
  { path: "/admin/orders", label: "Orders", icon: Receipt },
  { path: "/admin/customers", label: "Customers", icon: Users },
  { path: "/admin/credits", label: "Credits", icon: Ticket },
  { path: "/admin/discounts", label: "Discounts", icon: Tag },
  { path: "/admin/newsletter", label: "Newsletter", icon: Mail },
  { path: "/admin/inventory", label: "Inventory", icon: Boxes },
  { path: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/admin/collections", label: "Collections", icon: Sparkles },
  { path: "/admin/products", label: "Products", icon: Package },
  { path: "/admin/journal", label: "Journal", icon: FileText },
  { path: "/admin/content", label: "Content", icon: LayoutList },
  { path: "/admin/stockists", label: "Stockists", icon: MapPin },
  { path: "/admin/settings", label: "Settings", icon: Settings },
] as const;

/** A single UI boolean. Never an identifier, never anything about an order. */
const RAIL_KEY = "khem.admin.rail";

/** The width at which the drawer becomes a column — Tailwind's `lg`. */
const DESKTOP = "(min-width: 1024px)";

const RAIL_ID = "admin-rail";

function readStored(): boolean | null {
  try {
    const value = window.localStorage.getItem(RAIL_KEY);
    if (value === "open") return true;
    if (value === "closed") return false;
    return null;
  } catch {
    // Private mode, or storage disabled. The default is a fine answer.
    return null;
  }
}

export default function AdminShell({
  locale,
  actorEmail,
  notifications,
  lowStock,
  children,
}: {
  locale: Locale;
  actorEmail: string;
  /**
   * The bell's contents, read by the layout on every admin render.
   *
   * Passed down rather than fetched here: this is a Client Component, and the
   * feed is a secret-key read that must not be reachable from a browser.
   */
  notifications: readonly AdminNotification[];
  lowStock: readonly LowStockItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();

  /** `null` until the media query has been asked. */
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  /** `null` until resolved — see the note at the top of this file. */
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP);

    function resolve(desktop: boolean) {
      setIsDesktop(desktop);
      // A collapsed rail is a desktop preference. On a phone the drawer always
      // starts closed, or it would cover the screen the desk just opened.
      setOpen(desktop ? (readStored() ?? true) : false);
    }

    resolve(query.matches);

    function onChange(event: MediaQueryListEvent) {
      resolve(event.matches);
    }

    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  /**
   * A tapped section navigates, and a drawer left open would cover the screen
   * it just opened. Closed on the click rather than in an effect watching
   * `pathname`: the click is the event, and reacting to the route afterwards
   * would be a render cascade chasing something React already told us about.
   */
  const closeOnMobile = useCallback(() => {
    if (isDesktop === false) setOpen(false);
  }, [isDesktop]);

  useEffect(() => {
    if (isDesktop !== false || open !== true) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDesktop, open]);

  const toggle = useCallback(() => {
    setOpen((current) => {
      const next = !(current ?? true);

      if (isDesktop) {
        try {
          window.localStorage.setItem(RAIL_KEY, next ? "open" : "closed");
        } catch {
          // Nothing to do — the rail simply reverts to its default next time.
        }
      }

      return next;
    });
  }, [isDesktop]);

  /** `/admin` is active only on itself; every other section owns its subtree. */
  function isActive(path: string): boolean {
    const href = localizePath(locale, path);
    if (path === "/admin") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const resolved = open !== null;
  /** Before resolution the CSS default decides, and it matches `true` at `lg`. */
  const shown = open ?? true;
  const showScrim = resolved && open === true && isDesktop === false;

  const railPosition = !resolved
    ? "-translate-x-full rtl:translate-x-full lg:translate-x-0"
    : open
      ? "translate-x-0"
      : "-translate-x-full rtl:translate-x-full lg:hidden";

  return (
    /*
     * The guard wraps the whole shell, not the panel: the links it protects are
     * in the rail, which is a sibling of the panel the editor renders into.
     *
     * The dialog is injected rather than imported by the provider, which knows
     * nothing about how the house looks — see that file's header.
     */
    <AdminToastProvider>
    <UnsavedChangesProvider
      renderDialog={(pending, close) => (
        <UnsavedChangesDialog pending={pending} onClose={close} />
      )}
    >
    <div
      className={`min-h-screen bg-background pt-20 text-ivory lg:grid ${
        !resolved || open ? "lg:grid-cols-[260px_1fr]" : "lg:grid-cols-[1fr]"
      }`}
    >
      {/* The scrim: mobile only, and only while the drawer is out. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 top-20 z-30 bg-black/60 backdrop-blur-md transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:hidden ${
          showScrim ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id={RAIL_ID}
        aria-hidden={resolved && !open ? true : undefined}
        // `start-0` rather than `left-0`: the inline offset and the transform
        // must agree on which edge is home, or the RTL drawer parks mid-screen.
        className={`fixed bottom-0 start-0 top-20 z-40 w-[280px] overflow-y-auto border-e border-border bg-surface py-8 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:sticky lg:bottom-auto lg:h-[calc(100vh-5rem)] lg:w-auto lg:py-12 lg:transition-none ${railPosition}`}
      >
        <div className="px-8">
          <p className="font-heading text-[11px] uppercase tracking-[0.3em] text-gold">
            KHEM
          </p>
          <p className="mt-1 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/30">
            Boutique Desk
          </p>
        </div>

        <nav className="mt-6 md:mt-10 flex flex-col gap-1 px-4">
          {SECTIONS.map((section) => {
            const active = isActive(section.path);
            const Icon = section.icon;

            return (
              <AdminLink
                key={section.path}
                href={localizePath(locale, section.path)}
                aria-current={active ? "page" : undefined}
                tabIndex={resolved && !open ? -1 : undefined}
                onClick={closeOnMobile}
                className={`flex shrink-0 items-center gap-3 border-s-2 px-4 py-3 font-heading text-[10px] uppercase tracking-[0.2em] transition-colors duration-300 ${
                  active
                    ? "border-gold bg-gold/5 text-gold"
                    : "border-transparent text-ivory/40 hover:text-ivory"
                }`}
              >
                <Icon size={14} strokeWidth={1.25} />
                {section.label}
              </AdminLink>
            );
          })}
        </nav>

        <div className="mt-6 md:mt-10 border-t border-border px-8 pt-6">
          <p className="font-heading text-[9px] uppercase tracking-[0.2em] text-ivory/25">
            Signed in as
          </p>
          <p className="mt-1 break-all text-[11px] text-ivory/50">{actorEmail}</p>

          <AdminLink
            href={localizePath(locale, "/")}
            tabIndex={resolved && !open ? -1 : undefined}
            onClick={closeOnMobile}
            className="mt-5 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-ivory/35 transition-colors duration-300 hover:text-gold"
          >
            <ExternalLink size={12} strokeWidth={1.25} />
            View storefront
          </AdminLink>
        </div>
      </aside>

      <main className="min-w-0 px-5 pb-14 md:pb-24 sm:px-8 lg:px-14">
        {/*
          The toggle lives in the panel rather than in the rail, because a
          control that hides the rail cannot itself live inside the thing it
          hides. Sticky beneath the storefront nav so it is reachable from the
          bottom of a long order list.
        */}
        <div className="sticky top-20 z-20 -mx-5 mb-8 flex items-center gap-4 border-b border-border bg-background/90 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8 lg:-mx-14 lg:px-14">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={shown}
            aria-controls={RAIL_ID}
            className="inline-flex items-center gap-3 border border-border px-3 py-2 text-ivory/45 transition-colors duration-300 hover:border-gold/40 hover:text-gold"
          >
            {shown ? (
              <PanelLeftClose size={15} strokeWidth={1.25} />
            ) : (
              <PanelLeft size={15} strokeWidth={1.25} />
            )}
            <span className="sr-only">
              {shown ? "Hide navigation" : "Show navigation"}
            </span>
          </button>

          <p className="font-heading text-[10px] uppercase tracking-[0.25em] text-ivory/30">
            Boutique Desk
          </p>

          {/* Pushed to the trailing edge, opposite the rail toggle. */}
          <div className="ms-auto">
            <NotificationBell
              notifications={notifications}
              lowStock={lowStock}
              locale={locale}
            />
          </div>
        </div>

        <div className="pt-2">{children}</div>
      </main>
    </div>
    <AdminToaster />
    </UnsavedChangesProvider>
    </AdminToastProvider>
  );
}
