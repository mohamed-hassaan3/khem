"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  world,
  collections,
  quickAccess,
} from "../constants/navigation-pages";
import { Search, ShoppingBag, UserRound, X } from "lucide-react";

import nameLogo from "@/public/logo/name-logo-transparent.svg";

import SignOutButton from "./account/SignOutButton";
import LanguageSwitcher from "./i18n/LanguageSwitcher";
import LocaleLink from "./i18n/LocaleLink";
import SearchOverlay from "./search/SearchOverlay";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
import { localizePath } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import { useCart } from "@/src/providers/cart-provider";
import { useCartDrawer } from "@/src/providers/cart-drawer-provider";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";

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
  "group flex items-center gap-3 text-xs tracking-widest text-ivory/50 no-underline transition-colors duration-300 hover:text-gold";

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
      className="nav-link relative shrink-0 cursor-pointer"
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
          className="absolute -end-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-gold px-1 font-body text-[9px] leading-4 text-background"
        >
          {count}
        </span>
      ) : null}
    </button>
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

  const [scrolled, setScrolled] = useState(false);
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
  const navSolid = scrolled || activeMenu !== null || drawerOpen;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(null);
    setMenuPath(pathname);
  }, [pathname]);

  const closeDrawer = useCallback(() => {
    setDrawerRequested(false);
    setDrawerPath(pathname);
  }, [pathname]);

  const handleMenuToggle = (menu: string) => {
    setMenuPath(pathname);
    setMenuOpen((prev) => (prev === menu ? null : menu));
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
          "fixed inset-x-0 top-0 z-1000 flex h-20 items-center justify-between px-5 transition-all duration-500 sm:px-8 lg:px-12",
          "ease-luxury-bezier",
          navSolid
            ? "border-b border-border bg-[color-mix(in_srgb,var(--color-background)_96%,transparent)] backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
        ].join(" ")}
      >
        <div className="flex min-w-0 flex-1 items-center gap-9">
          <button
            type="button"
            aria-label={drawerOpen ? dict.nav.closeMenu : dict.nav.openMenu}
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav-drawer"
            onClick={handleDrawerToggle}
            className="-ms-2.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-ivory/70 transition-colors duration-300 hover:text-ivory lg:hidden"
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

          <div className="hidden items-center gap-9 lg:flex">
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
            className="h-10 w-auto sm:h-12 lg:h-14"
          />
        </LocaleLink>

        {/*
         * `min-w-0` on both rails, and a gap that opens up with the viewport:
         * the rails are `flex-1`, so on a 320px screen the row needs to tighten
         * rather than push its last icons past the edge.
         */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-4 sm:gap-5 lg:gap-7">
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
            className="nav-link shrink-0"
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
           * in, it becomes Clerk's avatar menu, themed by the provider's
           * appearance, with sign-out inside it.
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
            <span
              className="flex shrink-0 items-center"
              aria-label={dict.nav.accountMenu}
            >
              <UserButton
                userProfileMode="navigation"
                userProfileUrl={localizePath(locale, ACCOUNT_PATHS.profile)}
                appearance={{
                  elements: { avatarBox: { width: 26, height: 26 } },
                }}
              />
            </span>
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
              className="nav-link shrink-0"
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
          "fixed inset-y-0 start-0 z-1001 flex w-[85%] max-w-sm flex-col overflow-y-auto",
          "border-e border-border bg-[color-mix(in_srgb,var(--color-background)_97%,transparent)] backdrop-blur-xl",
          "transition-transform duration-500 ease-luxury-bezier lg:hidden",
          // Transforms are not mirrored by `dir`, so the RTL offset is explicit.
          drawerOpen
            ? "translate-x-0"
            : "-translate-x-full rtl:translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-20 shrink-0 items-center justify-between px-6">
          <p className="eyebrow">{dict.nav.menu}</p>
          <button
            type="button"
            aria-label={dict.nav.closeMenu}
            onClick={closeDrawer}
            className="-me-2.5 flex h-11 w-11 cursor-pointer items-center justify-center text-ivory/70 transition-colors duration-300 hover:text-gold"
          >
            <X />
          </button>
        </div>

        <div className="flex flex-col gap-10 px-6 pb-14">
          <section>
            <p className="eyebrow mb-6">{dict.nav.ourCollections}</p>
            <div className="flex flex-col gap-5">
              {collections.map((c) => (
                <LocaleLink
                  key={c.path}
                  href={c.path}
                  onClick={closeDrawer}
                  className="group block no-underline"
                >
                  <p className="mb-1 font-heading text-sm tracking-widest text-ivory transition-colors duration-300 group-hover:text-gold">
                    {dict.nav.collectionItems[c.key].label}
                  </p>
                  <p className="text-[11px] tracking-wider text-ivory/40">
                    {dict.nav.collectionItems[c.key].desc}
                  </p>
                </LocaleLink>
              ))}
            </div>
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
                  className="group flex items-center gap-3 text-xs tracking-widest text-ivory/50 no-underline transition-colors duration-300 hover:text-gold"
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
                  className="font-heading text-sm tracking-widest text-ivory no-underline transition-colors duration-300 hover:text-gold"
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
                className="group flex cursor-pointer items-center gap-3 text-start text-xs tracking-widest text-ivory/50 transition-colors duration-300 hover:text-gold"
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
                <span className="flex items-center gap-3 text-ivory/50">
                  <span
                    aria-hidden="true"
                    className="inline-block h-px w-5 bg-current"
                  />
                  <SignOutButton className="text-xs tracking-widest text-ivory/50 hover:text-gold" />
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
          className="fixed inset-0 z-1000 cursor-default bg-black/60 lg:hidden"
          onClick={closeDrawer}
        />
      )}

      <div
        className={`mega-menu hidden lg:block ${activeMenu === "collections" ? "open" : ""}`}
        onMouseLeave={closeMenu}
      >
        <div className="mx-auto grid max-w-300 grid-cols-3 gap-12">
          <div>
            <p className="eyebrow mb-6">{dict.nav.ourCollections}</p>
            <div className="flex flex-col gap-5">
              {collections.map((c) => (
                <LocaleLink
                  key={c.path}
                  href={c.path}
                  className="group block no-underline"
                >
                  <p className="mb-1 font-heading text-[13px] tracking-widest text-ivory transition-colors duration-300 group-hover:text-gold">
                    {dict.nav.collectionItems[c.key].label}
                  </p>
                  <p className="text-[11px] tracking-wider text-ivory/40">
                    {dict.nav.collectionItems[c.key].desc}
                  </p>
                </LocaleLink>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow mb-6">{dict.nav.featured}</p>
            {/* The tile is captioned "New Arrival", so it points at the
                showroom and names the fragrance actually flagged as new. */}
            <LocaleLink
              href="/new-arrival"
              className="relative block overflow-hidden rounded-sm no-underline"
            >
              <Image
                src="https://images.unsplash.com/photo-1709662217788-6a8a1b31562a?w=400&h=240&fit=crop&auto=format"
                alt={dict.nav.featuredCollectionAlt}
                width={400}
                height={200}
                className="block h-50 w-full object-cover brightness-[0.7]"
              />
              <div className="absolute bottom-4 start-4">
                <p className="eyebrow">{dict.nav.newArrival}</p>
                <p className="mt-1 font-heading text-sm text-ivory">
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
                  className="group flex items-center gap-3 text-xs tracking-widest text-ivory/50 no-underline transition-colors duration-300 hover:text-gold"
                >
                  <span className="inline-block h-px w-5 bg-current" />
                  {dict.nav.quickAccessItems[item.key]}
                </LocaleLink>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`mega-menu hidden lg:block ${activeMenu === "world" ? "open" : ""}`}
        onMouseLeave={closeMenu}
      >
        <div className="mx-auto grid max-w-300 grid-cols-3 gap-12">
          <div>
            <p className="eyebrow mb-6">{dict.nav.discover}</p>
            <div className="flex flex-col gap-5">
              {world.map((w) => (
                <LocaleLink
                  key={w.path}
                  href={w.path}
                  className="group no-underline"
                >
                  <p className="font-heading text-[13px] tracking-widest text-ivory transition-colors duration-300 group-hover:text-gold">
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
                className="block h-45 w-full object-cover brightness-[0.55]"
              />
              <div className="absolute inset-0 flex flex-col justify-end px-6 py-5">
                <p className="eyebrow">{dict.nav.journalLabel}</p>
                <p className="mt-1.5 font-heading text-base text-ivory">
                  {dict.nav.featuredArticleTitle}
                </p>
              </div>
            </LocaleLink>
          </div>
        </div>
      </div>

      {activeMenu && (
        <button
          type="button"
          aria-label={dict.nav.closeMenu}
          className="fixed inset-0 z-998 hidden bg-black/50 lg:block"
          onClick={closeMenu}
        />
      )}
    </>
  );
}
