"use client";

/**
 * The Desk — the admin's own shell (prompts/admin-redesign-stage-6.md).
 *
 * The storefront's chrome is not rendered on `/admin` (`StorefrontOnly`), so
 * this is the whole frame: a slim header with a "find anything" jump, the
 * desktop rail, a phone tab bar, a full menu, and a tab row for entries that
 * hold several pages (Loyalty, Collections & categories, Stock, Story pages,
 * Sales & profit, Finance).
 *
 * Everything navigational comes from `admin-nav.ts`, one table, so the rail,
 * the menu, the tab bar, the section tabs and the jump search cannot disagree.
 * No route moved.
 *
 * A client component because the active state needs `usePathname()`. The
 * session was resolved by the layout; this receives the actor's email as a
 * prop and never asks who they are. Every link goes through `AdminLink`, so an
 * unsaved form still holds navigation.
 */

import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ExternalLink,
  House,
  Menu as MenuIcon,
  Megaphone,
  Package,
  Receipt,
  Search,
  X,
  Activity,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import AdminLink from "@/src/components/admin/AdminLink";
import AdminToaster from "@/src/components/admin/AdminToaster";
import NotificationBell from "@/src/components/admin/NotificationBell";
import UnsavedChangesDialog from "@/src/components/admin/UnsavedChangesDialog";
import {
  ADMIN_ENTRIES,
  ADMIN_NAV,
  ORDER_NUMBER,
  activeEntry,
  activeTab,
  groupOf,
  type AdminNavEntry,
} from "@/src/components/admin/admin-nav";
import { UMAMI_DASHBOARD_URL } from "@/src/lib/analytics/umami";
import { localizePath, stripLocale, type Locale } from "@/src/lib/i18n/config";
import { AdminToastProvider } from "@/src/providers/admin-toast-provider";
import {
  UnsavedChangesProvider,
  useUnsavedChanges,
} from "@/src/providers/unsaved-changes-provider";
import type { AdminNotification, LowStockItem } from "@/src/types/notification";

/** Groups that start folded in the rail unless the page is inside them. */
const FOLDED_BY_DEFAULT = new Set(["website", "money"]);

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
   * The bell's contents, read by the layout on every admin render. Passed down
   * because the feed is a secret-key read that must not be reachable from a
   * browser.
   */
  notifications: readonly AdminNotification[];
  lowStock: readonly LowStockItem[];
  children: ReactNode;
}) {
  return (
    <AdminToastProvider>
      <UnsavedChangesProvider
        renderDialog={(pending, close) => (
          <UnsavedChangesDialog pending={pending} onClose={close} />
        )}
      >
        <Desk
          locale={locale}
          actorEmail={actorEmail}
          notifications={notifications}
          lowStock={lowStock}
        >
          {children}
        </Desk>
        <AdminToaster />
      </UnsavedChangesProvider>
    </AdminToastProvider>
  );
}

function Desk({
  locale,
  actorEmail,
  notifications,
  lowStock,
  children,
}: {
  locale: Locale;
  actorEmail: string;
  notifications: readonly AdminNotification[];
  lowStock: readonly LowStockItem[];
  children: ReactNode;
}) {
  const { path } = stripLocale(usePathname());
  const entry = activeEntry(path);
  const group = groupOf(entry);
  const tab = entry ? activeTab(entry, path) : null;

  const href = useCallback((to: string) => localizePath(locale, to), [locale]);

  /** `null` closed; "menu" from the tab bar; "find" from the search button or ⌘K. */
  const [sheet, setSheet] = useState<"menu" | "find" | null>(null);
  const close = useCallback(() => setSheet(null), []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSheet((current) => (current ? null : "find"));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initial = (actorEmail.trim()[0] ?? "K").toUpperCase();

  return (
    <div data-admin-desk="" className="ground-ivory min-h-screen">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-ground-border bg-ground-bg px-4 lg:h-15 lg:gap-4 lg:px-6">
        <AdminLink
          href={href("/admin")}
          className="flex shrink-0 flex-col leading-none no-underline"
          aria-label="KHEM Desk, Today"
        >
          <span className="font-heading text-[15px] tracking-[0.22em] text-ground-accent">KHEM</span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.16em] text-ground-muted">Desk</span>
        </AdminLink>

        <button
          type="button"
          onClick={() => setSheet("find")}
          className="ms-auto flex h-10 min-w-0 max-w-[13rem] flex-1 cursor-pointer items-center gap-2 rounded-lg border border-ground-border bg-stone px-3 text-[13px] text-ground-muted transition-colors duration-300 hover:border-gold/40 lg:ms-8 lg:max-w-[22rem]"
        >
          <Search size={15} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
          <span className="truncate">
            <span className="lg:hidden">Find anything…</span>
            <span className="hidden lg:inline">Jump to a section or an order</span>
          </span>
          <kbd className="ms-auto hidden rounded border border-ground-border px-1.5 font-body text-[11px] lg:inline">
            ⌘K
          </kbd>
        </button>

        <a
          href={href("/")}
          className="ms-auto hidden items-center gap-1.5 text-[13px] text-ground-muted no-underline transition-colors duration-300 hover:text-ground-accent lg:inline-flex"
        >
          View the shop
          <ExternalLink size={12} strokeWidth={1.5} aria-hidden="true" />
        </a>

        <NotificationBell notifications={notifications} lowStock={lowStock} locale={locale} />

        <span
          title={actorEmail}
          className="hidden size-9 shrink-0 place-items-center rounded-full border border-gold/50 font-heading text-[13px] text-ground-accent lg:grid"
        >
          {initial}
          <span className="sr-only">Signed in as {actorEmail}</span>
        </span>
      </header>

      <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* ── Desktop rail ─────────────────────────────────── */}
        <aside className="sticky top-15 hidden h-[calc(100svh-3.75rem)] flex-col overflow-y-auto border-e border-ground-border bg-stone px-3 py-5 lg:flex">
          <Rail locale={locale} current={entry} currentGroup={group} />

          <div className="mt-auto border-t border-ground-border px-3 pt-4">
            <p className="text-[11px] text-ground-muted">Signed in as</p>
            <p className="mt-0.5 break-all text-[12px] text-ground">{actorEmail}</p>
            <a
              href={UMAMI_DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-ground-muted no-underline hover:text-ground-accent"
            >
              <Activity size={13} strokeWidth={1.5} aria-hidden="true" />
              Visitors (Umami)
              <ExternalLink size={11} strokeWidth={1.5} aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </aside>

        {/* ── Panel ────────────────────────────────────────── */}
        <main className="min-w-0 px-4 pb-12 pt-5 sm:px-8 lg:px-12 lg:pb-16 lg:pt-8">
          <div className="mx-auto max-w-[1180px]">
            {entry?.tabs ? (
              <nav
                aria-label={`${entry.label} sections`}
                className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:mb-7"
              >
                {entry.tabs.map((item) => {
                  const on = item === tab;
                  return (
                    <AdminLink
                      key={item.href}
                      href={href(item.href)}
                      aria-current={on ? "page" : undefined}
                      className={[
                        "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-[13px] no-underline",
                        "transition-colors duration-300 ease-luxury-bezier",
                        on
                          ? "border-ground bg-ground text-ground-bg"
                          : "border-ground-border text-ground-muted hover:border-gold/40 hover:text-ground",
                      ].join(" ")}
                    >
                      {item.label}
                    </AdminLink>
                  );
                })}
              </nav>
            ) : null}

            <div id="admin-panel">{children}</div>
          </div>
        </main>
      </div>

      {/* ── Phone tab bar ──────────────────────────────────── */}
      <TabBar
        locale={locale}
        entry={entry}
        group={group}
        onMenu={() => setSheet("menu")}
        menuOpen={sheet === "menu"}
      />

      {sheet ? (
        <MenuSheet
          locale={locale}
          mode={sheet}
          current={entry}
          actorEmail={actorEmail}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

/* ───────────────────────── Rail ───────────────────────── */

function Rail({
  locale,
  current,
  currentGroup,
}: {
  locale: Locale;
  current: AdminNavEntry | null;
  currentGroup: string | null;
}) {
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => {
    const set = new Set(FOLDED_BY_DEFAULT);
    if (currentGroup) set.delete(currentGroup);
    return set;
  });

  // Arriving in a folded group (from the menu, the jump, a link in a page)
  // opens it. Derived during render, not in an effect: React's documented
  // pattern for adjusting state to a changed prop.
  const [seenGroup, setSeenGroup] = useState(currentGroup);
  if (seenGroup !== currentGroup) {
    setSeenGroup(currentGroup);
    if (currentGroup && folded.has(currentGroup)) {
      const next = new Set(folded);
      next.delete(currentGroup);
      setFolded(next);
    }
  }

  function toggle(key: string) {
    const next = new Set(folded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setFolded(next);
  }

  return (
    <nav aria-label="Desk sections" className="flex flex-col gap-0.5">
      {ADMIN_NAV.map((group) => {
        const isFolded = group.label !== null && folded.has(group.key);
        const listId = `rail-${group.key}`;

        return (
          <div key={group.key} className={group.label ? "mt-4" : group.key === "system" ? "mt-4" : ""}>
            {group.label ? (
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={!isFolded}
                aria-controls={listId}
                className="flex h-8 w-full cursor-pointer items-center px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ground-muted transition-colors duration-300 hover:text-ground"
              >
                {group.label}
                <ChevronDown
                  size={13}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className={`ms-auto transition-transform duration-300 ease-luxury-bezier ${isFolded ? "-rotate-90 rtl:rotate-90" : ""}`}
                />
              </button>
            ) : null}

            <div id={listId} hidden={isFolded} className="flex flex-col gap-0.5">
              {group.entries.map((item) => {
                const on = item === current;
                const Icon = item.icon;
                return (
                  <AdminLink
                    key={item.key}
                    href={localizePath(locale, item.href)}
                    aria-current={on ? "page" : undefined}
                    className={[
                      "flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] no-underline",
                      "transition-[background-color,color,box-shadow] duration-300 ease-luxury-bezier",
                      on
                        ? "bg-ground-bg font-medium text-ground-accent shadow-[inset_2px_0_0_var(--ground-accent)] rtl:shadow-[inset_-2px_0_0_var(--ground-accent)]"
                        : "text-ground hover:bg-ground-bg/60",
                    ].join(" ")}
                  >
                    <Icon size={17} strokeWidth={1.25} aria-hidden="true" className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </AdminLink>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/* ─────────────────────── Phone tab bar ─────────────────────── */

function TabBar({
  locale,
  entry,
  group,
  onMenu,
  menuOpen,
}: {
  locale: Locale;
  entry: AdminNavEntry | null;
  group: string | null;
  onMenu: () => void;
  menuOpen: boolean;
}) {
  const today = entry?.key === "today";
  const orders = entry?.key === "orders";
  const catalogue = group === "catalogue";
  const marketing = group === "marketing";
  const elsewhere = !today && !orders && !catalogue && !marketing;

  const tabs = [
    { key: "today", label: "Today", href: "/admin", icon: House, on: today },
    { key: "orders", label: "Orders", href: "/admin/orders", icon: Receipt, on: orders },
    { key: "catalogue", label: "Catalogue", href: "/admin/products", icon: Package, on: catalogue },
    { key: "marketing", label: "Marketing", href: "/admin/campaigns", icon: Megaphone, on: marketing },
  ];

  const itemClass = (on: boolean) =>
    [
      "relative flex h-[4.25rem] flex-col items-center justify-center gap-1 text-[11px] no-underline",
      "transition-colors duration-300 ease-luxury-bezier",
      on ? "text-ground-accent" : "text-ground-muted hover:text-ground",
    ].join(" ");

  const mark = (on: boolean) => (
    <span
      aria-hidden="true"
      className={`absolute -top-px left-1/2 h-0.5 w-10 -translate-x-1/2 bg-ground-accent transition-transform duration-500 ease-luxury-bezier motion-reduce:transition-none ${on ? "scale-x-100" : "scale-x-0"}`}
    />
  );

  return (
    <nav
      data-admin-tabbar=""
      aria-label="Desk"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ground-border bg-ground-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      {tabs.map(({ key, label, href, icon: Icon, on }) => (
        <AdminLink
          key={key}
          href={localizePath(locale, href)}
          aria-current={on ? "page" : undefined}
          className={itemClass(on)}
        >
          {mark(on)}
          <Icon size={21} strokeWidth={1.25} aria-hidden="true" />
          {label}
        </AdminLink>
      ))}
      <button
        type="button"
        onClick={onMenu}
        aria-expanded={menuOpen}
        aria-current={elsewhere ? "page" : undefined}
        className={`cursor-pointer ${itemClass(elsewhere)}`}
      >
        {mark(elsewhere)}
        <MenuIcon size={21} strokeWidth={1.25} aria-hidden="true" />
        Menu
      </button>
    </nav>
  );
}

/* ─────────────────────── Menu / jump sheet ─────────────────────── */

interface JumpResult {
  key: string;
  label: string;
  detail: string;
  href: string;
}

function search(query: string): JumpResult[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];

  const results: JumpResult[] = [];

  // An order number goes straight to that order.
  if (ORDER_NUMBER.test(query.trim())) {
    const number = query.trim().toUpperCase();
    results.push({
      key: `order-${number}`,
      label: `Open order ${number}`,
      detail: "Orders",
      href: `/admin/orders/${number}`,
    });
  }

  for (const entry of ADMIN_ENTRIES) {
    const haystack = `${entry.label} ${entry.description} ${entry.keywords ?? ""}`.toLowerCase();
    if (haystack.includes(q)) {
      results.push({ key: entry.key, label: entry.label, detail: entry.description, href: entry.href });
    }
    for (const tab of entry.tabs ?? []) {
      if (tab.href !== entry.href && tab.label.toLowerCase().includes(q)) {
        results.push({
          key: `${entry.key}-${tab.href}`,
          label: tab.label,
          detail: entry.label,
          href: tab.href,
        });
      }
    }
  }

  return results;
}

function MenuSheet({
  locale,
  mode,
  current,
  actorEmail,
  onClose,
}: {
  locale: Locale;
  mode: "menu" | "find";
  current: AdminNavEntry | null;
  actorEmail: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { requestNavigation } = useUnsavedChanges();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const results = useMemo(() => search(query), [query]);

  useEffect(() => {
    // Typing is the point of "find"; on a phone menu the keyboard would cover
    // the list the visitor opened it to read.
    if (mode === "find") inputRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [mode, onClose]);

  function go(to: string) {
    const target = localizePath(locale, to);
    onClose();
    const held = requestNavigation(() => router.push(target));
    if (!held) router.push(target);
  }

  return (
    <div className="fixed inset-0 z-50 flex lg:items-start lg:justify-center lg:pt-[10vh]">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 hidden cursor-default bg-ink/40 lg:block"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "find" ? "Find" : "Menu"}
        className="ground-ivory relative flex h-full w-full flex-col overflow-hidden bg-ground-bg lg:h-auto lg:max-h-[75vh] lg:max-w-xl lg:rounded-xl lg:border lg:border-ground-border lg:shadow-luxury"
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-ground-border px-4">
          <h2 className="font-heading text-[20px] font-normal text-ground">
            {mode === "find" ? "Find" : "Menu"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ms-auto grid size-11 cursor-pointer place-items-center rounded-lg border border-ground-border text-ground transition-colors duration-300 hover:border-gold/40"
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div className="shrink-0 px-4 pt-3">
          <label htmlFor="desk-jump" className="sr-only">
            Jump to a section or an order
          </label>
          <div className="flex h-11 items-center gap-2 rounded-lg border border-gold/50 bg-ivory px-3 focus-within:border-gold">
            <Search size={15} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-ground-muted" />
            <input
              ref={inputRef}
              id="desk-jump"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && results[0]) {
                  event.preventDefault();
                  go(results[0].href);
                }
              }}
              placeholder="A section, or an order number"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-ground outline-none placeholder:text-ground-subtle [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4">
          {query.trim().length > 0 ? (
            results.length > 0 ? (
              <ul className="overflow-hidden rounded-xl border border-ground-border bg-stone">
                {results.map((result, index) => (
                  <li key={result.key} className="border-b border-ground-border last:border-b-0">
                    <AdminLink
                      href={localizePath(locale, result.href)}
                      onClick={onClose}
                      className={`flex min-h-14 flex-col justify-center px-3 py-2 no-underline hover:bg-ground-bg/60 ${index === 0 ? "bg-ground-bg/60" : ""}`}
                    >
                      <span className="text-[14px] text-ground">{result.label}</span>
                      <span className="text-[12px] text-ground-muted">{result.detail}</span>
                    </AdminLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-ground-border px-4 py-6 text-center text-[13px] text-ground-muted">
                Nothing by that name. Try “orders”, “codes” or an order number.
              </p>
            )
          ) : (
            <nav aria-label="All desk sections" className="flex flex-col gap-4">
              {ADMIN_NAV.map((group) => (
                <section key={group.key}>
                  {group.label ? (
                    <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ground-accent">
                      {group.label}
                    </h3>
                  ) : null}
                  <ul className="overflow-hidden rounded-xl border border-ground-border bg-stone">
                    {group.entries.map((item) => {
                      const on = item === current;
                      return (
                        <li key={item.key} className="border-b border-ground-border last:border-b-0">
                          <AdminLink
                            href={localizePath(locale, item.href)}
                            onClick={onClose}
                            aria-current={on ? "page" : undefined}
                            className={`flex min-h-14 flex-col justify-center px-3 py-2 no-underline ${on ? "bg-ground-bg shadow-[inset_2px_0_0_var(--ground-accent)]" : "hover:bg-ground-bg/60"}`}
                          >
                            <span className={`text-[14px] ${on ? "font-medium text-ground-accent" : "text-ground"}`}>
                              {item.label}
                            </span>
                            <span className="text-[12px] text-ground-muted">{item.description}</span>
                          </AdminLink>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              <div className="mt-2 space-y-3 border-t border-ground-border px-1 pt-4 text-[12px] text-ground-muted">
                <p>
                  Signed in as <span className="break-all text-ground">{actorEmail}</span>
                </p>
                <p className="flex flex-wrap gap-x-5 gap-y-2">
                  <a href={localizePath(locale, "/")} className="no-underline text-ground-accent">
                    View the shop
                  </a>
                  <a href={UMAMI_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="no-underline text-ground-accent">
                    Visitors (Umami) ↗
                  </a>
                </p>
              </div>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
