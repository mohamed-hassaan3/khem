"use client";

import { useKhemSession } from "@/src/providers/session-provider";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  NavFeatures,
  NavEntry,
  NavLinkEntry,
  NavigationTree,
} from "@/src/types/navigation";
import {
  ChevronDown,
  ChevronLeft,
  Lock,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";

/*
 * The `.webp` mark, not the `.svg`.
 *
 * `name-logo-transparent.svg` is 425 KB and `logo-transparent.svg` is 442 KB —
 * both are traced bitmaps carrying seven decimal places per path coordinate.
 * `next/image` passes SVG through untouched, so the larger of the two was the
 * single biggest asset on every page of the site, ahead of every photograph
 * and every JavaScript chunk.
 *
 * A vector earns its size when it is going to be scaled. This mark renders at
 * 40-56 CSS pixels tall and never scales past it, so that precision was paying
 * for resolution nobody can resolve. Through the optimizer the same artwork is
 * a few kilobytes of AVIF at the size it is actually drawn.
 *
 * The SVGs stay in `public/logo/` for print and for anything that genuinely
 * needs to scale. They are simply off the critical path now.
 */
import nameLogo from "@/public/logo/name-logo-transparent.webp";

import AccountMenu from "./account/AccountMenu";
import SignOutButton from "./account/SignOutButton";
import LocaleRegionSwitcher from "./i18n/LocaleRegionSwitcher";
import LocaleLink from "./i18n/LocaleLink";
import SearchOverlay from "./search/SearchOverlay";
import { useHeaderVisibility } from "@/src/hooks/use-header-visibility";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
import { stripLocale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useCart } from "@/src/providers/cart-provider";
import { useCartDrawer } from "@/src/providers/cart-drawer-provider";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";
import { useNavGround } from "@/src/providers/nav-ground-provider";

/** Breakpoint (px) where the drawer gives way to the desktop mega menus. */
const DESKTOP_BREAKPOINT = 1024;

/**
 * One row in the mobile drawer's Boutique list.
 *
 * Extracted because the list is no longer uniform: the bag is a `<button>`
 * that opens the cart panel while its neighbours are links, and the two must
 * still be indistinguishable to the eye.
 */
/** A row in the phone menu's boutique card (Stage 3). */
const DRAWER_ROW =
  "flex min-h-11 items-center justify-between text-[13px] text-ground no-underline transition-colors duration-300 hover:text-ground-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ground-accent";

/**
 * The 44px hit area every header icon carries.
 *
 * The icons themselves stay 17px — this is padding around them, not a bigger
 * glyph. They were bare `nav-link` buttons with `padding: 0`, so their entire
 * tappable area was the 17x17 icon: a quarter of the 44px minimum, on the
 * three controls a phone actually needs (search, bag, account).
 *
 * The bar is 80px tall at every width, but the slack around a bare icon is
 * still incidental rather than declared; the target has to be stated. The negative margin on the last control pulls
 * the extra box back to the bar's own padding so the row still ends flush.
 */
const ICON_HIT =
  "flex h-11 w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent";

function SearchIcon() {
  return <Search width={17} height={17} />;
}

function AccountIcon() {
  return <UserRound width={17} height={17} />;
}

/**
 * Bag trigger with a live count.
 *
 * A `<button>`, not a link: it opens `<CartDrawer>` over the current page
 * rather than navigating to `/cart`. The route still exists and is one click
 * away inside the panel — leaving the catalog to look in the bag was the thing
 * the drawer removed, so the header control must not still do it.
 *
 * The badge is rendered only once the cart store has read `localStorage` — the
 * server HTML cannot know the count, so painting one before hydration would
 * mismatch. The count is carried in the button's accessible name rather than
 * announced from the badge, which stays decorative.
 */
function CartButton({
  label,
  labelWithCount,
  labelWithOne,
}: {
  label: string;
  labelWithCount: string;
  labelWithOne: string;
}) {
  const { count, isHydrated } = useCart();
  const { isOpen, open } = useCartDrawer();
  const showCount = isHydrated && count > 0;

  return (
    <button
      type="button"
      onClick={open}
      className={`nav-link relative shrink-0 cursor-pointer ${ICON_HIT}`}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-controls="cart-drawer"
      aria-label={
        showCount
          ? count === 1
            ? labelWithOne
            : interpolate(labelWithCount, { count })
          : label
      }
    >
      <ShoppingBag width={17} height={17} />
      {showCount ? (
        <span
          aria-hidden="true"
          /*
             The count reads against the header's ground, not against obsidian.
             A gold pill on an ivory bar is the 5% accent budget spent on a
             notification badge; the deep gold `--ground-accent` resolves to on
             light grounds keeps it legible without shouting.
          */
          className="absolute end-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-ground-accent px-1 font-body text-[9px] leading-4 text-ground-bg"
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

/**
 * The "Our Collections" list, shared by the drawer and the desktop mega menu.
 *
 * One component rather than the same markup written twice: the two surfaces
 * differ only in label size (`text-sm` in the drawer, `text-[13px]` in the
 * menu) and in whether a click has a panel to close, and a group that unfurls
 * on one surface but not the other would be a bug nobody notices for months.
 *
 * The group is a `<button>`, not a link. There is no "Fragrances" page — the
 * row exists to reveal the three collections underneath it, so a control is
 * what it is. Its children animate open on a grid-rows tween (the technique
 * that gets a height transition without a hard-coded height, and so without the
 * jump a `max-h` guess produces), and are `inert` while collapsed so a keyboard
 * or screen reader never lands inside a closed group.
 *
 * State lives here, one instance per surface. `Nav` remounts these on
 * navigation, which is what returns a group to collapsed — the same rule the
 * menus themselves follow.
 */
function CollectionsList({
  entries,
  labelClass,
  idPrefix,
  onNavigate,
  variant = "stack",
}: {
  /**
   * The resolved column — labels already in the reader's language and addresses
   * already derived, whether they came from `"NavLink"` or from the shipped
   * fallback tree. See `src/services/navigation.ts`.
   */
  entries: ReadonlyArray<NavEntry>;
  /** Typography for a row's label — the only difference between the surfaces. */
  labelClass: string;
  /** Namespaces the `aria-controls` targets, so the two surfaces cannot collide. */
  idPrefix: string;
  /** Closes the surface, where the surface is one that closes. */
  onNavigate?: () => void;
  /**
   * `stack`: the mega menu's column (names with their descriptions).
   * `rows`: the phone menu (Stage 3) — 52px ruled rows, names only, children
   * indented as 44px rows. Same tree, same accordion behaviour.
   */
  variant?: "stack" | "rows";
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  if (variant === "rows") {
    return (
      <ul className="border-t border-ground-border">
        {entries.map((entry) => {
          if (entry.kind === "link") {
            return (
              <li key={entry.id} className="border-b border-ground-border">
                <LocaleLink
                  href={entry.href}
                  onClick={onNavigate}
                  className="flex min-h-13 items-center font-heading text-[15px] tracking-[0.04em] text-ground no-underline transition-colors duration-300 hover:text-ground-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ground-accent"
                >
                  {entry.label}
                </LocaleLink>
              </li>
            );
          }
          const isOpen = openGroup === entry.id;
          const panelId = `${idPrefix}-${entry.id}`;
          return (
            <li key={entry.id} className="border-b border-ground-border">
              <button
                type="button"
                onClick={() => setOpenGroup(isOpen ? null : entry.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className={`flex min-h-13 w-full cursor-pointer items-center justify-between gap-3 text-start font-heading text-[15px] tracking-[0.04em] transition-colors duration-300 hover:text-ground-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ground-accent ${
                  isOpen ? "text-ground-accent" : "text-ground"
                }`}
              >
                {entry.label}
                <ChevronDown
                  aria-hidden="true"
                  width={16}
                  height={16}
                  strokeWidth={1.25}
                  className={`shrink-0 text-ground-muted transition-transform duration-400 ease-luxury-bezier motion-reduce:transition-none ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                id={panelId}
                inert={!isOpen}
                className={`grid transition-[grid-template-rows,opacity] duration-400 ease-luxury-bezier motion-reduce:transition-none ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <ul className="overflow-hidden">
                  {entry.children.map((child) => (
                    <li key={child.id}>
                      <LocaleLink
                        href={child.href}
                        onClick={onNavigate}
                        className="flex min-h-11 items-center ps-4 text-[13px] text-ground-muted no-underline transition-colors duration-300 hover:text-ground-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ground-accent"
                      >
                        {child.label}
                      </LocaleLink>
                    </li>
                  ))}
                  <li aria-hidden="true" className="h-2" />
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  const renderLink = (link: NavLinkEntry) => (
    <LocaleLink
      key={link.id}
      href={link.href}
      onClick={onNavigate}
      className="group block no-underline"
    >
      <p
        className={`mb-1 font-heading ${labelClass} tracking-widest text-ground transition-colors duration-300 group-hover:text-ground-accent`}
      >
        {link.label}
      </p>
      {/*
        A row created in the dashboard need not carry a description — a
        collection is a name and a place. The paragraph is omitted rather than
        rendered empty, so the column keeps its rhythm instead of printing a
        blank line under some rows and not others.
      */}
      {link.desc !== null ? (
        <p className="text-[11px] tracking-wider text-ground-muted">
          {link.desc}
        </p>
      ) : null}
    </LocaleLink>
  );

  return (
    <div className="flex flex-col gap-5">
      {entries.map((entry) => {
        if (entry.kind === "link") return renderLink(entry);

        const isOpen = openGroup === entry.id;
        const panelId = `${idPrefix}-${entry.id}`;

        return (
          <div key={entry.id}>
            <button
              type="button"
              onClick={() => setOpenGroup(isOpen ? null : entry.id)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className={`flex w-full cursor-pointer items-center justify-between gap-3 text-start font-heading ${labelClass} tracking-widest text-ground transition-colors duration-300 hover:text-ground-accent ${
                isOpen ? "text-ground-accent" : ""
              }`}
            >
              {entry.label}
              <ChevronDown
                aria-hidden="true"
                width={15}
                height={15}
                strokeWidth={1.25}
                className={[
                  "shrink-0 transition-transform duration-400",
                  "ease-luxury-bezier",
                  isOpen ? "rotate-180" : "rotate-0",
                ].join(" ")}
              />
            </button>

            <div
              id={panelId}
              inert={!isOpen}
              className={[
                "grid transition-all duration-400 ease-luxury-bezier",
                isOpen
                  ? "mt-5 grid-rows-[1fr] opacity-100"
                  : "mt-0 grid-rows-[0fr] opacity-0",
              ].join(" ")}
            >
              {/*
               * `overflow-hidden` is what lets the `0fr` row clip its content;
               * the border is the indent, drawn rather than only spaced, so the
               * three read as belonging to the row above them. Logical
               * properties throughout — the indent mirrors under `dir="rtl"`.
               */}
              <div className="overflow-hidden">
                <div className="flex flex-col gap-5 border-s border-ground-border ps-4">
                  {entry.children.map((child) => renderLink(child))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * ⚠️ TEMPORARY — `prelaunch` exists only while the pre-launch cover does.
 *
 * When it is true the header sheds every control that leads somewhere the
 * cover has closed: the Collections menu, the search panel and the bag. They
 * are hidden, not disabled — a visitor browsing the World of KHEM should not be
 * offered a door that answers with a redirect back to Coming Soon, which is
 * exactly how this looked when it was reported as a search bug.
 *
 * Nothing is rewritten to achieve it: each block below is wrapped in a guard
 * that is `false` in every normal deployment, so with the flag off this file
 * renders precisely what it rendered before. Delete the prop and its six guards
 * to remove the feature. See `src/docs/prelaunch.md`.
 */
export default function Nav({
  tree,
  features,
  prelaunch = false,
  semanticSearch = false,
}: {
  tree: NavigationTree;
  /** The menus' picture tiles: real new arrival and latest article (Stage 3). */
  features: NavFeatures;
  prelaunch?: boolean;
  /** Meaning-based search is configured on the server; see `<SearchOverlay>`. */
  semanticSearch?: boolean;
}) {
  const dict = useDictionary();
  const locale = useLocale();
  // Never loads Clerk for a signed-out visitor; see session-provider.tsx.
  const isSignedIn = useKhemSession().status === "signed-in";

  /*
   * Both shop columns come from `src/constants/navigation-pages.ts`, which the
   * Footer renders as well — the two surfaces offer the same ten destinations
   * because they read the same tables, not because someone kept two lists in
   * step. The drawer prints them as two stacked sections, having no second
   * column to put Quick Access in.
   */

  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const [drawerRequested, setDrawerRequested] = useState(false);
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const [searchRequested, setSearchRequested] = useState(false);
  const [searchPath, setSearchPath] = useState<string | null>(null);
  const pathname = usePathname();
  /*
   * Warm the mega menus' two photographs once a pointer (or focus) reaches
   * the menu links: off-screen copies with the tiles' own `sizes` fetch the
   * very file the tile will ask for, so the tile is painted when it opens
   * instead of a beat later.
   */
  const [warmTiles, setWarmTiles] = useState(false);

  /**
   * The search trigger, so focus can be returned to it on close — a modal
   * dialog that drops focus back on `<body>` strands a keyboard visitor at the
   * top of the document.
   */
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  const activeMenu = menuPath === pathname ? menuOpen : null;
  // Navigating away dismisses the drawer without an extra render pass.
  const drawerOpen = drawerPath === pathname && drawerRequested;
  // The same derivation for the search panel: a result link closes it.
  const searchOpen = searchPath === pathname && searchRequested;
  /*
   * What the header is sitting on, as declared by the page (`<NavGround>`).
   *
   * This decides the *colour* of the bar's wash and its links, and nothing
   * else — there is no second state for it to switch between. Ivory on every
   * route today, which resolves to charcoal links.
   */
  const { ground, back } = useNavGround();

  /*
   * Which header this route gets (Stage 2,
   * `prompts/storefront-redesign-stage-2.md` D3). Derived from the pathname so
   * the server HTML is already right:
   *
   *   task      checkout: back to the bag, the wordmark, "Secure". Nothing to
   *             browse to, at every width.
   *   purchase  a product or set page: on phones the menu button becomes a
   *             back chevron to the collection. Desktop is unchanged.
   */
  const routePath = stripLocale(pathname).path;
  const variant: "task" | "purchase" | "default" =
    routePath === "/checkout"
      ? "task"
      : /^\/(perfume|set|ritual)\//.test(routePath)
        ? "purchase"
        : "default";

  /*
   * The header leaves while the visitor reads down and comes back the moment
   * they read up — or send a mouse to the top edge.
   *
   * It is pinned open whenever one of the surfaces anchored to it is showing.
   * The mega-menu is positioned at `top: var(--header-h)` and the search panel
   * beneath the bar, so a header that slid away under an open menu would leave
   * the panel floating clear of anything; and the drawer scroll-locks the
   * document, which is exactly the state where the bar must not be off screen.
   */
  const headerHidden = useHeaderVisibility(
    activeMenu !== null || drawerOpen || searchOpen,
  );

  /*
   * The announcement bar is a sibling of this header, not a child — it is
   * rendered by the layout above `<Nav>` — so it cannot be moved by the
   * transform below. The flag goes on the document element and `globals.css`
   * translates the bar from there, which keeps the two halves of the chrome
   * travelling as one piece.
   */
  useEffect(() => {
    const root = document.documentElement;

    if (headerHidden) root.dataset.headerHidden = "true";
    else delete root.dataset.headerHidden;

    return () => {
      delete root.dataset.headerHidden;
    };
  }, [headerHidden]);

  const closeMenu = useCallback(() => {
    setMenuOpen(null);
    setMenuPath(pathname);
  }, [pathname]);

  const closeDrawer = useCallback(() => {
    setDrawerRequested(false);
    setDrawerPath(pathname);
  }, [pathname]);

  /**
   * Open a mega menu, or close the one that is showing.
   *
   * The comparison is against `activeMenu`, never against the raw `menuOpen`.
   * Navigating from a link *inside* a menu leaves `menuOpen` set while
   * `menuPath` goes stale, so the menu renders closed with the state still
   * saying "collections" — toggling that value would spend the first click
   * closing something the visitor cannot see, and the menu would appear to need
   * two clicks. Toggling what is rendered cannot drift from what is rendered.
   */
  const handleMenuToggle = (menu: string) => {
    setMenuPath(pathname);
    setMenuOpen(activeMenu === menu ? null : menu);
  };

  const handleDrawerToggle = () => {
    // The two navigation surfaces are mutually exclusive.
    closeMenu();
    setDrawerPath(pathname);
    setDrawerRequested(!drawerOpen);
  };

  /** Search takes over from whichever surface was open. */
  const openSearch = () => {
    closeMenu();
    setDrawerRequested(false);
    setSearchPath(pathname);
    setSearchRequested(true);
  };

  const closeSearch = useCallback(() => {
    setSearchRequested(false);
    setSearchPath(pathname);
    searchButtonRef.current?.focus();
  }, [pathname]);

  // Escape closes whichever surface is open.
  useEffect(() => {
    if (!drawerOpen && activeMenu === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDrawerRequested(false);
      closeMenu();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, activeMenu, closeMenu]);

  // Lock the page behind the drawer, and release the lock on close/unmount.
  useEffect(() => {
    if (!drawerOpen) return;

    /*
     * Locked on <html> as well as <body>: iOS Safari scrolls the root, so a
     * body-only lock let a swipe inside the menu move the page behind it.
     */
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [drawerOpen]);

  // A drawer left open while resizing up would strand the scroll lock.
  useEffect(() => {
    if (!drawerOpen) return;

    const onResize = () => {
      if (window.innerWidth >= DESKTOP_BREAKPOINT) setDrawerRequested(false);
    };

    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [drawerOpen]);

  /*
   * Checkout: a task header. The visitor is paying; the only ways out are back
   * to the bag and the wordmark. No search, menu, bag or account, so nothing
   * competes with the form. Same height and the same hide-on-scroll transform
   * as the full bar, so the header stack and every sticky offset still agree.
   */
  if (variant === "task") {
    return (
      <nav
        aria-label={dict.nav.checkoutLabel}
        className={[
          "fixed inset-x-0 top-[var(--announcement-h)] z-1000 h-[var(--nav-h)]",
          "nav-bar",
          `ground-${ground}`,
          "transition-transform duration-500 ease-luxury-bezier motion-reduce:transition-none",
          headerHidden
            ? "-translate-y-[calc(var(--header-h)+1px)]"
            : "translate-y-0",
        ].join(" ")}
      >
        <div className="mx-auto grid h-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-1.5 sm:px-6 lg:px-12">
          <LocaleLink
            href="/cart"
            aria-label={dict.nav.backToBag}
            className={`nav-link justify-self-start ${ICON_HIT}`}
          >
            <ChevronLeft
              width={22}
              height={22}
              strokeWidth={1.25}
              aria-hidden="true"
              className="rtl:-scale-x-100"
            />
          </LocaleLink>
          <LocaleLink href="/" className="flex items-center no-underline">
            <Image
              src={nameLogo}
              alt="KHEM Perfumes"
              loading="eager"
              fetchPriority="low"
              sizes="(min-width: 1024px) 132px, 94px"
              className="h-9 w-auto sm:h-10 lg:h-14"
            />
          </LocaleLink>
          <p className="flex items-center gap-1.5 justify-self-end pe-3 text-[10px] uppercase tracking-[0.16em] text-ground-muted">
            <Lock width={13} height={13} strokeWidth={1.25} aria-hidden="true" />
            {dict.nav.secure}
          </p>
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav
        className={[
          /*
           * `top` is the announcement bar's height, not zero.
           *
           * `--announcement-h` is `0px` unless the layout rendered a bar (see
           * `globals.css`), so this collapses to the original `top-0` on every
           * page that has none. Doing it here rather than by wrapping the header
           * is what keeps `<Nav>` a single fixed element — the mega-menu and the
           * mobile drawer are positioned against it, and a wrapper would have
           * become their containing block.
           */
          /*
           * `top` is the announcement bar's height, not zero — see the note
           * above. `nav-bar` carries the whole appearance, which is one state:
           * translucent with a subtle blur, identical at every scroll
           * position on every route. See `globals.css` for the wash values and
           * what the blur costs.
           */
          /*
           * `h-20` at every width — the single value `--nav-h` carries in
           * `globals.css`, which is what the page wrapper and every sticky
           * offset read. The two must agree: this class is what the bar *is*,
           * and the variable is what everything else *reserves* for it.
           *
           * It was `h-14` on a phone, to spend less of a short viewport on
           * chrome. The bar now leaves on its own while the visitor reads
           * down, so the argument for a shorter one is gone — and a header
           * that changes height with the breakpoint gives the wordmark and the
           * icon row two different compositions to be right in.
           */
          "fixed inset-x-0 top-[var(--announcement-h)] z-1000 flex h-[var(--nav-h)] items-center justify-between px-1.5 sm:px-6 lg:px-12",
          "nav-bar",
          /*
           * **The same ground in both states.**
           *
           * This used to branch — the page's ground when solid, `obsidian`
           * when transparent — because a transparent header floated over a
           * photograph that had been darkened to a third of its luminance, and
           * needed ivory type to survive it.
           *
           * No banner on the site is dark any more. They run at their own
           * luminance under a bounded ivory scrim and set their type in
           * charcoal, so the header floating over one needs *charcoal* type
           * too, which is the page's own ground. Branching to obsidian here
           * would now paint ivory links onto a pale limestone photograph —
           * the invisible header this whole mechanism exists to prevent, just
           * inverted from the direction it used to fail in.
           *
           * The legibility that used to come from darkening the image comes
           * from `.nav-bar`'s veil gradient instead.
           */
          `ground-${ground}`,
          /*
           * The smart-header transform.
           *
           * `--header-h`, not `--nav-h`: the bar sits below the announcement
           * bar, so clearing its own height alone would leave it parked over
           * the promo line rather than off the screen. The extra pixel covers
           * the hairline a fractional device-pixel ratio can otherwise leave
           * behind at the top edge.
           *
           * A transform and nothing else. `--header-h` is unchanged whichever
           * state this is in, so the page's top padding, every sticky offset
           * and the mega-menu's `top` all stay exactly where they were —
           * there is no layout for this to shift.
           */
          "transition-transform duration-500 ease-luxury-bezier motion-reduce:transition-none",
          headerHidden
            ? "-translate-y-[calc(var(--header-h)+1px)]"
            : "translate-y-0",
        ].join(" ")}
      >
        <div className="flex min-w-0 flex-1 items-center gap-5 md:gap-9">
          {variant === "purchase" ? (
            <LocaleLink
              href={back?.href ?? "/collections"}
              aria-label={interpolate(dict.nav.back, {
                name: back?.label ?? dict.nav.collections,
              })}
              className={`nav-link shrink-0 lg:hidden ${ICON_HIT}`}
            >
              <ChevronLeft
                width={22}
                height={22}
                strokeWidth={1.25}
                aria-hidden="true"
                className="rtl:-scale-x-100"
              />
            </LocaleLink>
          ) : null}
          <button
            type="button"
            aria-label={drawerOpen ? dict.nav.closeMenu : dict.nav.openMenu}
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav-drawer"
            onClick={handleDrawerToggle}
            className={`${variant === "purchase" ? "hidden" : "flex"} h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-ground-muted transition-colors duration-300 hover:text-ground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent lg:hidden`}
          >
            <span className="relative block h-3 w-5" aria-hidden="true">
              <span
                className={[
                  "absolute start-0 block h-px w-full bg-current transition-all duration-400",
                  "ease-luxury-bezier",
                  drawerOpen ? "top-1.5 rotate-45" : "top-0 rotate-0",
                ].join(" ")}
              />
              <span
                className={[
                  "absolute start-0 block h-px w-full bg-current transition-all duration-400",
                  "ease-luxury-bezier",
                  drawerOpen ? "top-1.5 -rotate-45" : "top-3 rotate-0",
                ].join(" ")}
              />
            </span>
          </button>

          <div
            className="hidden items-center gap-5 md:gap-9 lg:flex"
            onPointerEnter={() => setWarmTiles(true)}
            onFocus={() => setWarmTiles(true)}
          >
            {prelaunch ? null : (
              <button
                type="button"
                className={`nav-link ${activeMenu === "collections" ? "active" : ""}`}
                onClick={() => handleMenuToggle("collections")}
              >
                {dict.nav.collections}
              </button>
            )}
            <button
              type="button"
              className={`nav-link ${activeMenu === "world" ? "active" : ""}`}
              onClick={() => handleMenuToggle("world")}
            >
              {dict.nav.worldOfKhem}
            </button>
            <LocaleLink href="/stockists" className="nav-link">
              {dict.nav.stockists}
            </LocaleLink>
          </div>
        </div>

        <LocaleLink
          href="/"
          className="flex shrink-0 items-center no-underline"
          onClick={() => {
            closeMenu();
            closeDrawer();
          }}
        >
          {/*
           * Static import, not a string path — see the matching note in
           * `Footer.tsx`. A relative `src` resolves against the *directory* of
           * the current URL, so `"logo/…"` became `/logo/…` on `/ar` (which
           * sits at the root and worked by accident) but `/ar/logo/…` on every
           * deeper prefixed route — a 404 the catch-all answered with a full
           * page render, on a `priority` image preloaded on every page. It is `loading="eager"`
           * rather than `priority` for the same reason in reverse: a preload
           * hint on every route competes with the hero for the LCP bandwidth.
           * Importing the asset makes a relative path unrepresentable.
           */}
          <Image
            src={nameLogo}
            alt="KHEM Perfumes"
            loading="eager"
            // Low, so React does not auto-preload it ahead of the page's LCP
            // image (React 19 preloads every eager <img> it server-renders).
            fetchPriority="low"
            sizes="(min-width: 1024px) 132px, (min-width: 640px) 113px, 94px"
            className="h-9 w-auto sm:h-10 lg:h-14"
          />
        </LocaleLink>

        {/*
         * `min-w-0` on both rails, and a gap that opens up with the viewport:
         * the rails are `flex-1`, so on a 320px screen the row needs to tighten
         * rather than push its last icons past the edge.
         */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-0 sm:gap-1.5 lg:-me-2.5 lg:gap-3">
          <div className="hidden sm:block">
            <LocaleRegionSwitcher />
          </div>
          {/*
           * Visible at every width. It used to be `hidden sm:inline-flex`,
           * which left a phone with no way to search at all — and a phone is
           * where searching instead of browsing a mega-menu matters most.
           */}
          {prelaunch ? null : (
            <>
              <button
                ref={searchButtonRef}
                type="button"
                className={`nav-link shrink-0 ${ICON_HIT}`}
                aria-label={dict.nav.search}
                aria-haspopup="dialog"
                aria-expanded={searchOpen}
                aria-controls="search-overlay"
                onClick={openSearch}
              >
                <SearchIcon />
              </button>
              <CartButton
                label={dict.nav.cart}
                labelWithCount={dict.nav.cartCount}
                labelWithOne={dict.nav.cartCountOne}
              />
            </>
          )}
          {/*
           * Signed out, the icon leads straight to the sign-in page carrying
           * the current path as the return target. It used to point at
           * `/account` and let the proxy bounce it, which meant someone who
           * clicked it halfway down a product page was deposited in the
           * portal after signing in and had to find their way back. Signed
           * in, it becomes `<AccountMenu>` — the house's own popover, which
           * replaced Clerk's `<UserButton>`; that component's header says why.
           *
           * `useKhemSession()` rather than Clerk's hooks: Clerk is loaded only
           * for signed-in visitors (prompts/clerk-load-only-where-needed.md),
           * so a signed-out page has no Clerk context to ask.
           *
           * The link is what renders while the session is still resolving, so the
           * rail never collapses to a gap mid-hydration — the icon and the
           * avatar occupy the same 26px box.
           */}
          {isSignedIn ? (
            <AccountMenu />
          ) : (
            /*
             * A plain `<Link>`, not `<LocaleLink>`: `signInPathWithReturn`
             * has already resolved the locale on both halves of this href.
             *
             * The target is the pathname alone — no query string. Reading one
             * would mean `useSearchParams()` in a component that renders in
             * the layout of every route, which opts all of them out of static
             * rendering. Facet state on a listing page is the only thing lost,
             * and it is not worth thirty dynamic pages.
             */
            <Link
              href={signInPathWithReturn(locale, pathname)}
              className={`nav-link shrink-0 ${ICON_HIT}`}
              aria-label={dict.nav.account}
            >
              <AccountIcon />
            </Link>
          )}
        </div>
      </nav>

      {warmTiles && !activeMenu ? (
        <div aria-hidden="true" className="pointer-events-none fixed -start-[9999px] top-0 hidden lg:block">
          {features.newArrival ? (
            <div className="relative h-56 w-100">
              <Image src={features.newArrival.imageUrl} alt="" fill sizes="400px" loading="eager" fetchPriority="low" />
            </div>
          ) : null}
          {features.article ? (
            <div className="relative h-56 w-200">
              <Image src={features.article.imageUrl} alt="" fill sizes="800px" loading="eager" fetchPriority="low" />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── SEARCH PANEL ───────────────────────────── */}
      <SearchOverlay
        open={searchOpen}
        onClose={closeSearch}
        semanticSearch={semanticSearch}
        /*
          The shelves from the menu the header is already holding, capped at
          six. Filtering on `isShelf` is what keeps the scent profiles and Best
          Sellers out: the panel offers parts of the catalogue to search
          *within*, and no product belongs to one of those.
        */
        shortcuts={tree.collections
          .flatMap((entry) => (entry.kind === "group" ? entry.children : [entry]))
          .filter((entry) => entry.isShelf)
          .slice(0, 6)}
      />

      {/* ── MOBILE DRAWER ──────────────────────────── */}
      <div
        id="mobile-nav-drawer"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
        className={[
          /*
           * `ground-ivory`, explicitly, even though the `<nav>` above is now
           * ground-aware — *because* it is. The drawer is a child of the
           * header, and the header's ground follows the page; a drawer that
           * inherited it would change colour depending on which route the
           * visitor happened to open the menu from. An overlay is its own
           * surface (§20) and states it.
           *
           * Ivory, not the full-screen black panel this was. §20 is explicit:
           * the mobile menu belongs to the same environment as the site.
           *
           * `nav-drawer` gives it the bar's treatment — a translucent wash over
           * a blur — rather than a flat fill, so the two read as one piece of
           * chrome. It can carry a heavier wash and a wider radius than the bar
           * because the document behind it is scroll-locked while it is open,
           * so this blur is never recomputed frame after frame.
           */
          "ground-ivory nav-drawer fixed inset-y-0 start-0 z-1001 flex w-[85%] max-w-sm flex-col overflow-y-auto overscroll-contain",
          "border-e border-ground-border shadow-3",
          "transition-transform duration-500 ease-luxury-bezier lg:hidden",
          // Transforms are not mirrored by `dir`, so the RTL offset is explicit.
          drawerOpen
            ? "translate-x-0"
            : "-translate-x-full rtl:translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-ground-border ps-5 pe-2">
          <p className="eyebrow">{dict.nav.menu}</p>
          <button
            type="button"
            aria-label={dict.nav.closeMenu}
            onClick={closeDrawer}
            className="flex h-11 w-11 cursor-pointer items-center justify-center text-ground transition-colors duration-300 hover:text-ground-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ground-accent"
          >
            <X width={20} height={20} strokeWidth={1.25} />
          </button>
        </div>

        {/*
          Stage 3 (`prompts/chrome-and-discovery-stage-3.md`): a picture first
          (the real new arrival), the shop as ruled accordion rows, quick
          access as chips, the house's pages as rows, then the boutique and
          language. Search and the bag are not repeated here: they are in the
          header the visitor just tapped.
        */}
        <div className="flex flex-col gap-6 px-5 pb-10 pt-5">
          {prelaunch ? null : (
            <>
              {features.newArrival ? (
                <LocaleLink
                  href={features.newArrival.href}
                  onClick={closeDrawer}
                  className="group relative block h-36 shrink-0 overflow-hidden rounded-lg bg-sand no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent"
                >
                  <Image
                    src={features.newArrival.imageUrl}
                    alt={features.newArrival.imageAlt}
                    fill
                    sizes="340px"
                    className="object-cover"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-linear-to-t from-ink/75 via-ink/15 to-transparent"
                  />
                  <span className="absolute inset-x-4 bottom-3.5 block">
                    <span className="block text-[10px] uppercase tracking-[0.22em] text-gold-soft">
                      {dict.nav.newArrival}
                    </span>
                    <span
                      dir="ltr"
                      className="mt-1 block font-heading text-lg text-ivory rtl:text-right"
                    >
                      {features.newArrival.title}
                    </span>
                  </span>
                </LocaleLink>
              ) : null}

              <section aria-label={dict.nav.ourCollections}>
                <p className="eyebrow mb-2">{dict.nav.ourCollections}</p>
                <CollectionsList
                  key={pathname}
                  entries={tree.collections}
                  labelClass="text-sm"
                  idPrefix="drawer-collections"
                  onNavigate={closeDrawer}
                  variant="rows"
                />
              </section>

              <section aria-label={dict.nav.quickAccess}>
                <p className="eyebrow mb-3">{dict.nav.quickAccess}</p>
                <ul className="flex flex-wrap gap-2">
                  {tree.quickAccess.map((item) => (
                    <li key={item.id}>
                      <LocaleLink
                        href={item.href}
                        onClick={closeDrawer}
                        className="inline-flex min-h-10 items-center rounded-full border border-ground-accent/40 px-4 text-xs text-ground no-underline transition-colors duration-300 hover:border-ground-accent hover:bg-ground-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent"
                      >
                        {item.label}
                      </LocaleLink>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          <section aria-label={dict.nav.discover}>
            <p className="eyebrow mb-2">{dict.nav.discover}</p>
            <ul className="border-t border-ground-border">
              {tree.world.map((item) => (
                <li key={item.id} className="border-b border-ground-border">
                  <LocaleLink
                    href={item.href}
                    onClick={closeDrawer}
                    className="flex min-h-12 items-center font-heading text-sm tracking-[0.04em] text-ground no-underline transition-colors duration-300 hover:text-ground-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ground-accent"
                  >
                    {item.label}
                  </LocaleLink>
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-label={dict.nav.boutique}
            className="ground-stone rounded-lg bg-ground-bg px-4 py-1"
          >
            <LocaleLink
              href="/stockists"
              onClick={closeDrawer}
              className={DRAWER_ROW}
            >
              {dict.nav.stockists}
              <ChevronDown
                aria-hidden="true"
                width={14}
                height={14}
                strokeWidth={1.25}
                className="-rotate-90 text-ground-muted rtl:rotate-90"
              />
            </LocaleLink>
            <LocaleLink
              href="/account"
              onClick={closeDrawer}
              className={`${DRAWER_ROW} border-t border-ground-border`}
            >
              {dict.nav.account}
              <ChevronDown
                aria-hidden="true"
                width={14}
                height={14}
                strokeWidth={1.25}
                className="-rotate-90 text-ground-muted rtl:rotate-90"
              />
            </LocaleLink>
            {/* Only a session the server confirmed can sign out. */}
            {isSignedIn ? (
              <div className="flex min-h-11 items-center border-t border-ground-border">
                <SignOutButton className="text-[13px] text-ground-muted hover:text-ground-accent" />
              </div>
            ) : null}
          </section>

          <section aria-label={dict.regionSwitcher.label}>
            <p className="eyebrow mb-3">{dict.regionSwitcher.label}</p>
            <LocaleRegionSwitcher variant="full" />
          </section>
        </div>
      </div>

      {drawerOpen && (
        <button
          type="button"
          aria-label={dict.nav.closeMenu}
          className="fixed inset-0 z-1000 cursor-default touch-none bg-ink/45 lg:hidden"
          onClick={closeDrawer}
        />
      )}

      {/*
       * Mounted only while open.
       *
       * Both panels used to be in the DOM permanently at `opacity: 0`, each
       * `position: fixed`, full-width, and carrying `backdrop-filter:
       * blur(20px)` from `.mega-menu`. A hidden blur layer is not a free one:
       * the compositor kept two of them live for the whole session, over the
       * whole viewport, on every desktop page. Rendering them conditionally is
       * what actually removes that cost — restyling `.mega-menu` alone would
       * have left two invisible fixed layers behind.
       *
       * The opacity/transform transition is preserved: the element still
       * mounts in its closed state and `.open` is applied by the same class
       * toggle, so the entry animation is unchanged. Only the *closed* case
       * costs nothing now.
       */}
      {activeMenu === "collections" && (
      <div
        className="mega-menu ground-ivory open hidden lg:block"
        onMouseLeave={closeMenu}
      >
        <div className="mx-auto grid max-w-300 grid-cols-3 gap-6 md:gap-12">
          <div>
            <p className="eyebrow mb-6">{dict.nav.ourCollections}</p>
            <CollectionsList
              key={pathname}
              entries={tree.collections}
              labelClass="text-[13px]"
              idPrefix="mega-collections"
            />
          </div>
          <div>
            {/* The real new arrival (Stage 3); no tile when there is none. */}
            {features.newArrival ? (
              <>
                <p className="eyebrow mb-6">{dict.nav.featured}</p>
                <LocaleLink
                  href={features.newArrival.href}
                  className="group relative block h-56 overflow-hidden rounded-lg bg-sand no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent"
                >
                  <Image
                    src={features.newArrival.imageUrl}
                    alt={features.newArrival.imageAlt}
                    fill
                    sizes="400px"
                    loading="eager"
                    className="object-cover transition-transform duration-700 ease-luxury-bezier group-hover:scale-[1.03] motion-reduce:transition-none"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-linear-to-t from-ink/70 via-ink/10 to-transparent"
                  />
                  <span className="absolute inset-x-5 bottom-4 block">
                    <span className="block text-[10px] uppercase tracking-[0.22em] text-gold-soft">
                      {dict.nav.newArrival}
                    </span>
                    <span dir="ltr" className="mt-1 block font-heading text-xl text-ivory rtl:text-right">
                      {features.newArrival.title}
                    </span>
                  </span>
                </LocaleLink>
              </>
            ) : null}
          </div>
          <div>
            <p className="eyebrow mb-6">{dict.nav.quickAccess}</p>
            <div className="flex flex-col gap-3.5">
              {tree.quickAccess.map((item) => (
                <LocaleLink
                  key={item.id}
                  href={item.href}
                  className="group flex items-center gap-3 text-xs tracking-widest text-ground-muted no-underline transition-colors duration-300 hover:text-ground-accent"
                >
                  <span className="inline-block h-px w-5 bg-current" />
                  {item.label}
                </LocaleLink>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {activeMenu === "world" && (
      <div
        className="mega-menu ground-ivory open hidden lg:block"
        onMouseLeave={closeMenu}
      >
        <div className="mx-auto grid max-w-300 grid-cols-3 gap-6 md:gap-12">
          <div>
            <p className="eyebrow mb-6">{dict.nav.discover}</p>
            <div className="flex flex-col gap-5">
              {tree.world.map((item) => (
                <LocaleLink
                  key={item.id}
                  href={item.href}
                  className="group no-underline"
                >
                  <p className="font-heading text-[13px] tracking-widest text-ground transition-colors duration-300 group-hover:text-ground-accent">
                    {item.label}
                  </p>
                </LocaleLink>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            {/* The latest article (Stage 3); no tile when the journal is empty. */}
            {features.article ? (
              <>
                <p className="eyebrow mb-6">{dict.nav.fromTheJournal}</p>
                <LocaleLink
                  href={features.article.href}
                  className="group relative block h-56 overflow-hidden rounded-lg bg-sand no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent"
                >
                  <Image
                    src={features.article.imageUrl}
                    alt={features.article.imageAlt}
                    fill
                    sizes="800px"
                    loading="eager"
                    className="object-cover transition-transform duration-700 ease-luxury-bezier group-hover:scale-[1.03] motion-reduce:transition-none"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-linear-to-t from-ink/70 via-ink/10 to-transparent"
                  />
                  <span dir="auto" className="absolute inset-x-6 bottom-5 block">
                    <span className="block text-[10px] uppercase tracking-[0.22em] text-gold-soft">
                      {features.article.category}
                    </span>
                    <span className="mt-1.5 block font-heading text-lg text-ivory">
                      {features.article.title}
                    </span>
                  </span>
                </LocaleLink>
              </>
            ) : null}
          </div>
        </div>
      </div>
      )}

      {activeMenu && (
        <button
          type="button"
          aria-label={dict.nav.closeMenu}
          className="fixed inset-0 z-998 hidden bg-ink/35 lg:block"
          onClick={closeMenu}
        />
      )}
    </>
  );
}
