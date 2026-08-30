"use client";

import { useAuth } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CollectionEntry,
  CollectionGroupKey,
  CollectionKey,
} from "../constants/navigation-pages";
import {
  world,
  collections,
  quickAccess,
} from "../constants/navigation-pages";
import { ChevronDown, Search, ShoppingBag, UserRound, X } from "lucide-react";

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
import LanguageSwitcher from "./i18n/LanguageSwitcher";
import LocaleLink from "./i18n/LocaleLink";
import SearchOverlay from "./search/SearchOverlay";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
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
const BOUTIQUE_ROW =
  "group flex items-center gap-3 text-xs tracking-widest text-ground-muted no-underline transition-colors duration-300 hover:text-ground-accent";

/**
 * The 44px hit area every header icon carries.
 *
 * The icons themselves stay 17px — this is padding around them, not a bigger
 * glyph. They were bare `nav-link` buttons with `padding: 0`, so their entire
 * tappable area was the 17x17 icon: a quarter of the 44px minimum, on the
 * three controls a phone actually needs (search, bag, account).
 *
 * It matters more now than it did. The bar is 56px tall on a phone, so there
 * is no longer any incidental slack around a bare icon for a thumb to land in;
 * the target has to be declared. The negative margin on the last control pulls
 * the extra box back to the bar's own padding so the row still ends flush.
 */
const ICON_HIT = "flex h-11 w-11 items-center justify-center";

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
  groupLabels,
  itemLabels,
  onNavigate,
}: {
  entries: ReadonlyArray<CollectionEntry>;
  /** Typography for a row's label — the only difference between the surfaces. */
  labelClass: string;
  /** Namespaces the `aria-controls` targets, so the two surfaces cannot collide. */
  idPrefix: string;
  groupLabels: Record<CollectionGroupKey, string>;
  itemLabels: Record<CollectionKey, { label: string; desc: string }>;
  /** Closes the surface, where the surface is one that closes. */
  onNavigate?: () => void;
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const renderLink = (key: CollectionKey, path: string) => (
    <LocaleLink
      key={path}
      href={path}
      onClick={onNavigate}
      className="group block no-underline"
    >
      <p
        className={`mb-1 font-heading ${labelClass} tracking-widest text-ground transition-colors duration-300 group-hover:text-ground-accent`}
      >
        {itemLabels[key].label}
      </p>
      <p className="text-[11px] tracking-wider text-ground-muted">
        {itemLabels[key].desc}
      </p>
    </LocaleLink>
  );

  return (
    <div className="flex flex-col gap-5">
      {entries.map((entry) => {
        if (entry.kind === "link") return renderLink(entry.key, entry.path);

        const isOpen = openGroup === entry.key;
        const panelId = `${idPrefix}-${entry.key}`;

        return (
          <div key={entry.key}>
            <button
              type="button"
              onClick={() => setOpenGroup(isOpen ? null : entry.key)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className={`flex w-full cursor-pointer items-center justify-between gap-3 text-start font-heading ${labelClass} tracking-widest text-ground transition-colors duration-300 hover:text-ground-accent ${
                isOpen ? "text-ground-accent" : ""
              }`}
            >
              {groupLabels[entry.key]}
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
                  {entry.children.map((child) =>
                    renderLink(child.key, child.path),
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Nav() {
  const dict = useDictionary();
  const locale = useLocale();
  const { isSignedIn } = useAuth();
  const { open: openCartDrawer } = useCartDrawer();

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
  const { ground } = useNavGround();

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

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
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
           * `h-14` on a phone, `h-20` from `md` up — the same two values
           * `--nav-h` carries in `globals.css`, which is what the page wrapper
           * and every sticky offset read. The two must agree: this class is
           * what the bar *is*, and the variable is what everything else
           * *reserves* for it.
           *
           * The controls inside are unchanged at 44px — the 24px comes off the
           * padding around them, not off the touch targets.
           */
          "fixed inset-x-0 top-[var(--announcement-h)] z-1000 flex h-14 items-center justify-between px-5 sm:px-8 md:h-20 lg:px-12",
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
        ].join(" ")}
      >
        <div className="flex min-w-0 flex-1 items-center gap-5 md:gap-9">
          <button
            type="button"
            aria-label={drawerOpen ? dict.nav.closeMenu : dict.nav.openMenu}
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav-drawer"
            onClick={handleDrawerToggle}
            className="-ms-2.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-ground-muted transition-colors duration-300 hover:text-ground lg:hidden"
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

          <div className="hidden items-center gap-5 md:gap-9 lg:flex">
            <button
              type="button"
              className={`nav-link ${activeMenu === "collections" ? "active" : ""}`}
              onClick={() => handleMenuToggle("collections")}
            >
              {dict.nav.collections}
            </button>
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
           * page render, on a `priority` image preloaded on every page.
           * Importing the asset makes a relative path unrepresentable.
           */}
          <Image
            src={nameLogo}
            alt="KHEM Perfumes"
            priority
            sizes="(min-width: 1024px) 132px, (min-width: 640px) 113px, 94px"
            className="h-10 w-auto sm:h-12 lg:h-14"
          />
        </LocaleLink>

        {/*
         * `min-w-0` on both rails, and a gap that opens up with the viewport:
         * the rails are `flex-1`, so on a 320px screen the row needs to tighten
         * rather than push its last icons past the edge.
         */}
        <div className="-me-2.5 flex min-w-0 flex-1 items-center justify-end gap-0.5 sm:gap-1.5 lg:gap-3">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          {/*
           * Visible at every width. It used to be `hidden sm:inline-flex`,
           * which left a phone with no way to search at all — and a phone is
           * where searching instead of browsing a mega-menu matters most.
           */}
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
          {/*
           * Signed out, the icon leads straight to the sign-in page carrying
           * the current path as the return target. It used to point at
           * `/account` and let the proxy bounce it, which meant someone who
           * clicked it halfway down a product page was deposited in the
           * portal after signing in and had to find their way back. Signed
           * in, it becomes `<AccountMenu>` — the house's own popover, which
           * replaced Clerk's `<UserButton>`; that component's header says why.
           *
           * `useAuth()` rather than the `<Show>` control component: the root
           * `Show` export in `@clerk/nextjs` is the App Router *server*
           * variant (an async component), and this is a client component.
           *
           * The link is what renders while Clerk is still resolving, so the
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

      {/* ── SEARCH PANEL ───────────────────────────── */}
      <SearchOverlay open={searchOpen} onClose={closeSearch} />

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
          "ground-ivory nav-drawer fixed inset-y-0 start-0 z-1001 flex w-[85%] max-w-sm flex-col overflow-y-auto",
          "border-e border-ground-border shadow-3",
          "transition-transform duration-500 ease-luxury-bezier lg:hidden",
          // Transforms are not mirrored by `dir`, so the RTL offset is explicit.
          drawerOpen
            ? "translate-x-0"
            : "-translate-x-full rtl:translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-6 md:h-20">
          <p className="eyebrow">{dict.nav.menu}</p>
          <button
            type="button"
            aria-label={dict.nav.closeMenu}
            onClick={closeDrawer}
            className="-me-2.5 flex h-11 w-11 cursor-pointer items-center justify-center text-ground-muted transition-colors duration-300 hover:text-ground-accent"
          >
            <X />
          </button>
        </div>

        <div className="flex flex-col gap-5 md:gap-10 px-6 pb-14">
          <section>
            <p className="eyebrow mb-6">{dict.nav.ourCollections}</p>
            <CollectionsList
              key={pathname}
              entries={collections}
              labelClass="text-sm"
              idPrefix="drawer-collections"
              groupLabels={dict.nav.collectionGroups}
              itemLabels={dict.nav.collectionItems}
              onNavigate={closeDrawer}
            />
          </section>

          <div className="gold-line" />

          <section>
            <p className="eyebrow mb-6">{dict.nav.quickAccess}</p>
            <div className="flex flex-col gap-3.5">
              {quickAccess.map((item) => (
                <LocaleLink
                  key={item.path}
                  href={item.path}
                  onClick={closeDrawer}
                  className="group flex items-center gap-3 text-xs tracking-widest text-ground-muted no-underline transition-colors duration-300 hover:text-ground-accent"
                >
                  <span className="inline-block h-px w-5 bg-current" />
                  {dict.nav.quickAccessItems[item.key]}
                </LocaleLink>
              ))}
            </div>
          </section>

          <div className="gold-line" />

          <section>
            <p className="eyebrow mb-6">{dict.nav.discover}</p>
            <div className="flex flex-col gap-5">
              {world.map((w) => (
                <LocaleLink
                  key={w.path}
                  href={w.path}
                  onClick={closeDrawer}
                  className="font-heading text-sm tracking-widest text-ground no-underline transition-colors duration-300 hover:text-ground-accent"
                >
                  {dict.nav.worldItems[w.key].label}
                </LocaleLink>
              ))}
            </div>
          </section>

          <div className="gold-line" />

          <section>
            <p className="eyebrow mb-6">{dict.nav.boutique}</p>
            <div className="flex flex-col gap-3.5">
              {/*
               * Search is a control, not a destination, so it sits above the
               * links rather than inside the list — the drawer is the only
               * place a phone can reach the panel from besides the header.
               */}
              <button
                type="button"
                onClick={() => {
                  closeDrawer();
                  openSearch();
                }}
                className="group flex cursor-pointer items-center gap-3 text-start text-xs tracking-widest text-ground-muted transition-colors duration-300 hover:text-ground-accent"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-px w-5 bg-current"
                />
                {dict.nav.search}
              </button>

              <LocaleLink
                href="/stockists"
                onClick={closeDrawer}
                className={BOUTIQUE_ROW}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-px w-5 bg-current"
                />
                {dict.nav.stockists}
              </LocaleLink>

              {/*
               * The bag is a control here too, for the same reason it is in the
               * header: it opens the panel rather than navigating. The nav
               * drawer stands down first — two overlays on a phone at once is
               * one too many, and the cart panel is the one that was asked for.
               */}
              <button
                type="button"
                onClick={() => {
                  closeDrawer();
                  openCartDrawer();
                }}
                aria-haspopup="dialog"
                aria-controls="cart-drawer"
                className={`${BOUTIQUE_ROW} cursor-pointer text-start`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-px w-5 bg-current"
                />
                {dict.nav.cart}
              </button>

              <LocaleLink
                href="/account"
                onClick={closeDrawer}
                className={BOUTIQUE_ROW}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-px w-5 bg-current"
                />
                {dict.nav.account}
              </LocaleLink>

              {/*
               * The drawer is the only account surface on a phone, so it
               * carries sign-out directly rather than sending the visitor to
               * `/account` to find it. Hidden entirely for a guest, for whom
               * it would be a control with nothing to end.
               */}
              {isSignedIn ? (
                <span className="flex items-center gap-3 text-ground-muted">
                  <span
                    aria-hidden="true"
                    className="inline-block h-px w-5 bg-current"
                  />
                  <SignOutButton className="text-xs tracking-widest text-ground-muted hover:text-ground-accent" />
                </span>
              ) : null}
            </div>
          </section>

          <div className="gold-line" />

          <section>
            <p className="eyebrow mb-6">{dict.languageSwitcher.label}</p>
            <LanguageSwitcher variant="full" />
          </section>
        </div>
      </div>

      {drawerOpen && (
        <button
          type="button"
          aria-label={dict.nav.closeMenu}
          className="fixed inset-0 z-1000 cursor-default bg-ink/45 lg:hidden"
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
              entries={collections}
              labelClass="text-[13px]"
              idPrefix="mega-collections"
              groupLabels={dict.nav.collectionGroups}
              itemLabels={dict.nav.collectionItems}
            />
          </div>
          <div>
            <p className="eyebrow mb-6">{dict.nav.featured}</p>
            {/* The tile is captioned "New Arrival", so it points at the
                showroom and names the fragrance actually flagged as new. */}
            <LocaleLink
              href="/new-arrival"
              className="relative block overflow-hidden rounded-sm no-underline"
            >
              {/*
                No `brightness-[0.7]`. The tile sits inside an ivory panel and
                its caption is charcoal, so dimming the photograph made the
                words *less* readable, not more — it was tuned for the ivory
                caption this menu carried while the panel was obsidian.
              */}
              <Image
                src="https://images.unsplash.com/photo-1709662217788-6a8a1b31562a?w=400&h=240&fit=crop&auto=format"
                alt={dict.nav.featuredCollectionAlt}
                width={400}
                height={200}
                className="block h-50 w-full object-cover"
              />
              {/* An ivory field under the caption, bounded to the lower third. */}
              <div
                aria-hidden="true"
                className="banner-scrim banner-scrim-base"
              />
              <div className="absolute bottom-4 start-4">
                <p className="eyebrow">{dict.nav.newArrival}</p>
                <p className="mt-1 font-heading text-sm text-ground">
                  {dict.nav.featuredProduct}
                </p>
              </div>
            </LocaleLink>
          </div>
          <div>
            <p className="eyebrow mb-6">{dict.nav.quickAccess}</p>
            <div className="flex flex-col gap-3.5">
              {quickAccess.map((item) => (
                <LocaleLink
                  key={item.path}
                  href={item.path}
                  className="group flex items-center gap-3 text-xs tracking-widest text-ground-muted no-underline transition-colors duration-300 hover:text-ground-accent"
                >
                  <span className="inline-block h-px w-5 bg-current" />
                  {dict.nav.quickAccessItems[item.key]}
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
              {world.map((w) => (
                <LocaleLink
                  key={w.path}
                  href={w.path}
                  className="group no-underline"
                >
                  <p className="font-heading text-[13px] tracking-widest text-ground transition-colors duration-300 group-hover:text-ground-accent">
                    {dict.nav.worldItems[w.key].label}
                  </p>
                </LocaleLink>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <p className="eyebrow mb-6">{dict.nav.fromTheJournal}</p>
            <LocaleLink
              href="/journal"
              className="relative block overflow-hidden rounded-sm no-underline"
            >
              <Image
                src="https://images.unsplash.com/photo-1678287714479-adaa0cfbe6c6?w=700&h=220&fit=crop&auto=format"
                alt={dict.nav.featuredArticleAlt}
                width={700}
                height={180}
                className="block h-45 w-full object-cover"
              />
              <div
                aria-hidden="true"
                className="banner-scrim banner-scrim-base"
              />
              <div className="absolute inset-0 flex flex-col justify-end px-6 py-5">
                <p className="eyebrow">{dict.nav.journalLabel}</p>
                <p className="mt-1.5 font-heading text-base text-ground">
                  {dict.nav.featuredArticleTitle}
                </p>
              </div>
            </LocaleLink>
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
