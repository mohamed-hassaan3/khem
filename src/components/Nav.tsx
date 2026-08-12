"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { world, collections } from "../constants/navigation-pages";
import { Heart, Search, ShoppingBag, UserRound, X } from "lucide-react";

import nameLogo from "@/public/logo/name-logo-transparent.svg";

import LanguageSwitcher from "./i18n/LanguageSwitcher";
import LocaleLink from "./i18n/LocaleLink";
import { facetHref } from "@/src/lib/facets";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useCart } from "@/src/providers/cart-provider";
import { useDictionary } from "@/src/providers/i18n-provider";

/** Breakpoint (px) where the drawer gives way to the desktop mega menus. */
const DESKTOP_BREAKPOINT = 1024;

function SearchIcon() {
  return <Search width={17} height={17} />;
}

function WishlistIcon() {
  return <Heart width={17} height={17} />;
}

function AccountIcon() {
  return <UserRound width={17} height={17} />;
}

/**
 * Bag link with a live count.
 *
 * The badge is rendered only once the cart store has read `localStorage` — the
 * server HTML cannot know the count, so painting one before hydration would
 * mismatch. The count is carried in the link's accessible name rather than
 * announced from the badge, which stays decorative.
 */
function CartLink({
  label,
  labelWithCount,
  labelWithOne,
}: {
  label: string;
  labelWithCount: string;
  labelWithOne: string;
}) {
  const { count, isHydrated } = useCart();
  const showCount = isHydrated && count > 0;

  return (
    <LocaleLink
      href="/cart"
      className="nav-link relative"
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
    </LocaleLink>
  );
}

export default function Nav() {
  const dict = useDictionary();

  /**
   * The merchandising shortcuts, shared by the desktop mega-menu column and the
   * mobile drawer.
   *
   * New Arrivals and Gift Sets are deliberately *not* in the "Our Collections"
   * list beside them: that list is the collections themselves, and printing the
   * same two destinations twice in one menu reads as a mistake. The drawer has
   * no second column to put them in, so it renders this list as its own
   * section — otherwise removing them from the collections list would strand
   * both pages on mobile.
   *
   * Best Sellers and Limited Editions are cuts across every collection rather
   * than chapters of one, so they address the `/collections` facet filter
   * rather than a route of their own. See `src/lib/facets.ts`.
   */
  const quickAccess = [
    [dict.nav.quickAccessItems.newArrivals, "/new-arrival"],
    [dict.nav.quickAccessItems.bestSellers, facetHref("best-sellers")],
    [dict.nav.quickAccessItems.giftSets, "/gift-set"],
    [dict.nav.quickAccessItems.limitedEditions, facetHref("limited")],
  ] as const;

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const [drawerRequested, setDrawerRequested] = useState(false);
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const pathname = usePathname();

  const activeMenu = menuPath === pathname ? menuOpen : null;
  // Navigating away dismisses the drawer without an extra render pass.
  const drawerOpen = drawerPath === pathname && drawerRequested;
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
        <div className="flex flex-1 items-center gap-9">
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

        <div className="flex flex-1 items-center justify-end gap-5 sm:gap-7">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <button
            type="button"
            className="nav-link hidden sm:inline-flex"
            aria-label={dict.nav.search}
          >
            <SearchIcon />
          </button>
          <LocaleLink
            href="/wishlist"
            className="nav-link hidden sm:inline-flex"
            aria-label={dict.nav.wishlist}
          >
            <WishlistIcon />
          </LocaleLink>
          <CartLink
            label={dict.nav.cart}
            labelWithCount={dict.nav.cartCount}
            labelWithOne={dict.nav.cartCountOne}
          />
          <LocaleLink
            href="/account"
            className="nav-link"
            aria-label={dict.nav.account}
          >
            <AccountIcon />
          </LocaleLink>
        </div>
      </nav>

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
              {quickAccess.map(([label, path]) => (
                <LocaleLink
                  key={label}
                  href={path}
                  onClick={closeDrawer}
                  className="group flex items-center gap-3 text-xs tracking-widest text-ivory/50 no-underline transition-colors duration-300 hover:text-gold"
                >
                  <span className="inline-block h-px w-5 bg-current" />
                  {label}
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
              {(
                [
                  [dict.nav.stockists, "/stockists"],
                  [dict.nav.wishlist, "/wishlist"],
                  [dict.nav.cart, "/cart"],
                  [dict.nav.account, "/account"],
                ] as const
              ).map(([label, path]) => (
                <LocaleLink
                  key={path}
                  href={path}
                  onClick={closeDrawer}
                  className="group flex items-center gap-3 text-xs tracking-widest text-ivory/50 no-underline transition-colors duration-300 hover:text-gold"
                >
                  <span className="inline-block h-px w-5 bg-current" />
                  {label}
                </LocaleLink>
              ))}
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
              {quickAccess.map(([label, path]) => (
                <LocaleLink
                  key={label}
                  href={path}
                  className="group flex items-center gap-3 text-xs tracking-widest text-ivory/50 no-underline transition-colors duration-300 hover:text-gold"
                >
                  <span className="inline-block h-px w-5 bg-current" />
                  {label}
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
