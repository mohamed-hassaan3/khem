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
 * ## Grouped by job, not by table
 *
 * The rail used to be seventeen flat rows in frequency-of-use order, which asks
 * a new member of the desk "which table am I in?" instead of "what am I trying
 * to do?". It is now five named groups — Commerce, Marketing, Content,
 * Analytics, System — with Dashboard standing alone above them.
 *
 * **No route moved.** The grouping is presentation; every href here is the URL
 * it always was, so bookmarks, redirects and the 110 in-code references to
 * these paths are all still correct.
 *
 * World of KHEM's five pages are a second level, revealed only while the
 * editor is somewhere inside Content. Revealed from `pathname` rather than from
 * state: a rail that remembers which branch was open is a rail that disagrees
 * with the page beside it, and deriving it means there is nothing to hydrate.
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
  BadgePercent,
  BarChart3,
  Boxes,
  ExternalLink,
  Landmark,
  LayoutList,
  LayoutGrid,
  Package,
  PanelLeft,
  PanelLeftClose,
  Mail,
  MapPin,
  Megaphone,
  Tag,
  Ticket,
  Receipt,
  Send,
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
 * The rail, as five jobs rather than seventeen tables.
 *
 * Order within a group is still how often a desk reaches for it — Orders before
 * Stockists, Promotions before Announcements — because grouping answers "where
 * do I look?" and ordering answers "what do I open every morning?".
 *
 * `children` is a second level, and only Content has one. Journal keeps its own
 * top-level route while sitting under World of KHEM here: the IA is a claim
 * about where an editor looks for it, not a claim about where it lives.
 */
const GROUPS = [
  {
    heading: null,
    items: [{ path: "/admin", label: "Dashboard", icon: LayoutGrid }],
  },
  {
    heading: "Commerce",
    items: [
      { path: "/admin/orders", label: "Orders", icon: Receipt },
      { path: "/admin/customers", label: "Customers", icon: Users },
      { path: "/admin/products", label: "Products", icon: Package },
      { path: "/admin/collections", label: "Collections", icon: Sparkles },
      { path: "/admin/inventory", label: "Inventory", icon: Boxes },
      { path: "/admin/stockists", label: "Stockists", icon: MapPin },
    ],
  },
  {
    heading: "Marketing",
    items: [
      /*
       * Promotions sits beside Discounts, not inside it: one is a price the
       * catalogue carries and the other is a string somebody types. Neighbours
       * because a desk running a sale reaches for both in the same hour;
       * separate rows because they are separate systems with separate records.
       */
      { path: "/admin/promotions", label: "Promotions", icon: BadgePercent },
      { path: "/admin/discounts", label: "Discounts", icon: Tag },
      { path: "/admin/credits", label: "Credits", icon: Ticket },
      { path: "/admin/campaigns", label: "Campaigns", icon: Send },
      { path: "/admin/newsletter", label: "Newsletter", icon: Mail },
      { path: "/admin/announcements", label: "Announcements", icon: Megaphone },
    ],
  },
  {
    heading: "Content",
    items: [
      { path: "/admin/content/landing", label: "Landing Page", icon: LayoutList },
      {
        path: "/admin/content/world",
        label: "World of KHEM",
        icon: Landmark,
        children: [
          { path: "/admin/content/heritage", label: "Heritage" },
          { path: "/admin/content/craftsmanship", label: "Craftsmanship" },
          { path: "/admin/content/ingredients", label: "Ingredients" },
          { path: "/admin/journal", label: "Journal" },
          { path: "/admin/content/about", label: "About KHEM" },
        ],
      },
    ],
  },
  {
    heading: "Analytics",
    items: [{ path: "/admin/analytics", label: "Analytics", icon: BarChart3 }],
  },
  {
    heading: "System",
    items: [{ path: "/admin/settings", label: "Settings", icon: Settings }],
  },
] as const;

/**
 * Everything the Content group owns, including the two routes that do not sit
 * under `/admin/content`. Used to decide whether the second level is showing
 * and whether the World of KHEM row is the one being edited.
 */
const WORLD_PATHS = [
  "/admin/content/heritage",
  "/admin/content/craftsmanship",
  "/admin/content/ingredients",
  "/admin/journal",
  "/admin/content/about",
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

  /**
   * World of KHEM owns five pages, two of which are not under its own path —
   * `/admin/content/ingredients` and `/admin/journal` kept the URLs they have
   * always had. So the row's active state is the union, not a prefix test.
   */
  const inWorld =
    isActive("/admin/content/world") || WORLD_PATHS.some(isActive);

  /**
   * The second level shows while the editor is anywhere in Content — including
   * on the `/admin/content` hub itself, which is how they got there.
   */
  const showWorld = inWorld || isActive("/admin/content");

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
    {/*
      The dashboard ground.

      `ground-ivory` rather than a bare `bg-ivory`, so the panels, fields,
      cards and buttons inside it resolve their surface variables from a
      declared ground instead of from whatever `body` happens to be — the same
      contract every storefront section signs. §31: the dashboard is the same
      visual system as the shop, held to productivity rather than to cinema.
    */}
    <div
      className={`ground-ivory min-h-screen lg:grid ${
        !resolved || open ? "lg:grid-cols-[260px_1fr]" : "lg:grid-cols-[1fr]"
      }`}
    >
      {/* The scrim: mobile only, and only while the drawer is out. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 top-[var(--header-h)] z-30 bg-ink/45 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:hidden ${
          showScrim ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id={RAIL_ID}
        aria-hidden={resolved && !open ? true : undefined}
        // `start-0` rather than `left-0`: the inline offset and the transform
        // must agree on which edge is home, or the RTL drawer parks mid-screen.
        className={`ground-stone fixed bottom-0 start-0 top-[var(--header-h)] z-40 w-[280px] overflow-y-auto border-e border-ground-border py-8 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:sticky lg:bottom-auto lg:h-[calc(100svh-var(--header-h))] lg:w-auto lg:py-12 lg:transition-none ${railPosition}`}
      >
        <div className="px-8">
          <p className="font-heading text-[11px] uppercase tracking-[0.3em] text-ground-accent">
            KHEM
          </p>
          <p className="mt-1 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Boutique Desk
          </p>
        </div>

        <nav className="mt-6 md:mt-10 flex flex-col px-4">
          {GROUPS.map((group) => (
            <div
              key={group.heading ?? "root"}
              className={group.heading ? "mt-7 first:mt-0" : ""}
            >
              {group.heading ? (
                <p className="mb-2 px-4 font-heading text-[9px] uppercase tracking-[0.3em] text-ground-subtle">
                  {group.heading}
                </p>
              ) : null}

              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const children =
                    "children" in item ? item.children : undefined;
                  // The parent of a second level is lit by its whole branch.
                  const active = children ? inWorld : isActive(item.path);
                  const Icon = item.icon;

                  return (
                    <div key={item.path}>
                      <AdminLink
                        href={localizePath(locale, item.path)}
                        aria-current={active ? "page" : undefined}
                        tabIndex={resolved && !open ? -1 : undefined}
                        onClick={closeOnMobile}
                        className={`flex shrink-0 items-center gap-3 border-s-2 px-4 py-3 font-heading text-[10px] uppercase tracking-[0.2em] transition-colors duration-300 ${
                          active
                            ? "border-ground-accent bg-ivory text-ground"
                            : "border-transparent text-ground-muted hover:text-ground"
                        }`}
                      >
                        <Icon size={14} strokeWidth={1.25} />
                        {item.label}
                      </AdminLink>

                      {children && showWorld ? (
                        <div className="mt-1 flex flex-col gap-1">
                          {children.map((child) => {
                            const childActive = isActive(child.path);

                            return (
                              <AdminLink
                                key={child.path}
                                href={localizePath(locale, child.path)}
                                aria-current={childActive ? "page" : undefined}
                                tabIndex={resolved && !open ? -1 : undefined}
                                onClick={closeOnMobile}
                                className={`flex shrink-0 items-center border-s-2 py-2.5 ps-11 pe-4 text-[11px] tracking-[0.08em] transition-colors duration-300 ${
                                  childActive
                                    ? "border-ground-accent bg-ivory text-ground"
                                    : "border-transparent text-ground-muted hover:text-ground"
                                }`}
                              >
                                {child.label}
                              </AdminLink>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-6 md:mt-10 border-t border-ground-border px-8 pt-6">
          <p className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
            Signed in as
          </p>
          <p className="mt-1 break-all text-[11px] text-ground-muted">{actorEmail}</p>

          <AdminLink
            href={localizePath(locale, "/")}
            tabIndex={resolved && !open ? -1 : undefined}
            onClick={closeOnMobile}
            className="mt-5 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
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
        <div className="sticky top-[var(--header-h)] z-20 -mx-5 mb-8 flex items-center gap-4 border-b border-ground-border bg-ground-bg px-5 py-3 sm:-mx-8 sm:px-8 lg:-mx-14 lg:px-14">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={shown}
            aria-controls={RAIL_ID}
            className="inline-flex items-center gap-3 border border-ground-border px-3 py-2 text-ground-muted transition-colors duration-300 hover:border-gold/40 hover:text-ground-accent"
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

          <p className="font-heading text-[10px] uppercase tracking-[0.25em] text-ground-muted">
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
