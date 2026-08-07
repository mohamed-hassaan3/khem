"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { world, collections } from "../constants/navigation-pages";
import { Heart, Search, UserRound } from "lucide-react";

/** Breakpoint (px) where the drawer gives way to the desktop mega menus. */
const DESKTOP_BREAKPOINT = 1024;

function SearchIcon() {
  return (
    <Search width={17} height={17} />
  );
}

function WishlistIcon() {
  return (
    <Heart width={17} height={17} />
  );
}

function AccountIcon() {
  return (
    <UserRound width={17} height={17} />
  );
}

export default function Nav() {
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
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav-drawer"
            onClick={handleDrawerToggle}
            className="-ml-2.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-ivory/70 transition-colors duration-300 hover:text-ivory lg:hidden"
          >
            <span className="relative block h-3 w-5" aria-hidden="true">
              <span
                className={[
                  "absolute left-0 block h-px w-full bg-current transition-all duration-400",
                  "ease-luxury-bezier",
                  drawerOpen ? "top-1.5 rotate-45" : "top-0 rotate-0",
                ].join(" ")}
              />
              <span
                className={[
                  "absolute left-0 block h-px w-full bg-current transition-all duration-400",
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
              Collections
            </button>
            <button
              type="button"
              className={`nav-link ${activeMenu === "world" ? "active" : ""}`}
              onClick={() => handleMenuToggle("world")}
            >
              The World of KHEM
            </button>
            <Link href="/stockists" className="nav-link">
              Stockists
            </Link>
          </div>
        </div>

        <Link
          href="/"
          className="flex shrink-0 items-center no-underline"
          onClick={() => {
            closeMenu();
            closeDrawer();
          }}
        >
          <Image
            src="logo/name-logo-transparent.svg"
            alt="KHEM Perfumes"
            width={1273}
            height={540}
            priority
            className="h-10 w-auto sm:h-12 lg:h-14"
          />
        </Link>

        <div className="flex flex-1 items-center justify-end gap-5 sm:gap-7">
          <button
            type="button"
            className="nav-link hidden sm:inline-flex"
            aria-label="Search"
          >
            <SearchIcon />
          </button>
          <Link
            href="/wishlist"
            className="nav-link hidden sm:inline-flex"
            aria-label="Wishlist"
          >
            <WishlistIcon />
          </Link>
          <Link href="/account" className="nav-link" aria-label="Account">
            <AccountIcon />
          </Link>
        </div>
      </nav>

      {/* ── MOBILE DRAWER ──────────────────────────── */}
      <div
        id="mobile-nav-drawer"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
        className={[
          "fixed inset-y-0 left-0 z-1001 flex w-[85%] max-w-sm flex-col overflow-y-auto",
          "border-r border-border bg-[color-mix(in_srgb,var(--color-background)_97%,transparent)] backdrop-blur-xl",
          "transition-transform duration-500 ease-luxury-bezier lg:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-20 shrink-0 items-center justify-between px-6">
          <p className="eyebrow">Menu</p>
          <button
            type="button"
            aria-label="Close menu"
            onClick={closeDrawer}
            className="-mr-2.5 flex h-11 w-11 cursor-pointer items-center justify-center text-ivory/70 transition-colors duration-300 hover:text-gold"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              aria-hidden="true"
            >
              <line x1="1" y1="1" x2="14" y2="14" />
              <line x1="14" y1="1" x2="1" y2="14" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-10 px-6 pb-14">
          <section>
            <p className="eyebrow mb-6">Our Collections</p>
            <div className="flex flex-col gap-5">
              {collections.map((c) => (
                <Link
                  key={c.path}
                  href={c.path}
                  onClick={closeDrawer}
                  className="group block no-underline"
                >
                  <p className="mb-1 font-heading text-sm tracking-widest text-ivory transition-colors duration-300 group-hover:text-gold">
                    {c.label}
                  </p>
                  <p className="text-[11px] tracking-wider text-ivory/40">
                    {c.desc}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <div className="gold-line" />

          <section>
            <p className="eyebrow mb-6">Discover</p>
            <div className="flex flex-col gap-5">
              {world.map((w) => (
                <Link
                  key={w.path}
                  href={w.path}
                  onClick={closeDrawer}
                  className="font-heading text-sm tracking-widest text-ivory no-underline transition-colors duration-300 hover:text-gold"
                >
                  {w.label}
                </Link>
              ))}
            </div>
          </section>

          <div className="gold-line" />

          <section>
            <p className="eyebrow mb-6">Boutique</p>
            <div className="flex flex-col gap-3.5">
              {(
                [
                  ["Stockists", "/stockists"],
                  ["Wishlist", "/wishlist"],
                  ["Account", "/account"],
                ] as const
              ).map(([label, path]) => (
                <Link
                  key={label}
                  href={path}
                  onClick={closeDrawer}
                  className="group flex items-center gap-3 text-xs tracking-widest text-ivory/50 no-underline transition-colors duration-300 hover:text-gold"
                >
                  <span className="inline-block h-px w-5 bg-current" />
                  {label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>

      {drawerOpen && (
        <button
          type="button"
          aria-label="Close menu"
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
            <p className="eyebrow mb-6">Our Collections</p>
            <div className="flex flex-col gap-5">
              {collections.map((c) => (
                <Link
                  key={c.path}
                  href={c.path}
                  className="group block no-underline"
                >
                  <p className="mb-1 font-heading text-[13px] tracking-widest text-ivory transition-colors duration-300 group-hover:text-gold">
                    {c.label}
                  </p>
                  <p className="text-[11px] tracking-wider text-ivory/40">
                    {c.desc}
                  </p>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow mb-6">Featured</p>
            <Link
              href="/collections/signature"
              className="relative block overflow-hidden rounded-sm no-underline"
            >
              <Image
                src="https://images.unsplash.com/photo-1676950933747-5f886cadf014?w=400&h=240&fit=crop&auto=format"
                alt="Signature Collection"
                width={400}
                height={200}
                className="block h-50 w-full object-cover brightness-[0.7]"
              />
              <div className="absolute bottom-4 left-4">
                <p className="eyebrow">New Arrival</p>
                <p className="mt-1 font-heading text-sm text-ivory">Kyphi Noir</p>
              </div>
            </Link>
          </div>
          <div>
            <p className="eyebrow mb-6">Quick Access</p>
            <div className="flex flex-col gap-3.5">
              {(
                [
                  ["New Arrivals", "/collections"],
                  ["Best Sellers", "/collections"],
                  ["Gift Sets", "/discovery"],
                  ["Limited Editions", "/collections/noir"],
                ] as const
              ).map(([label, path]) => (
                <Link
                  key={label}
                  href={path}
                  className="group flex items-center gap-3 text-xs tracking-widest text-ivory/50 no-underline transition-colors duration-300 hover:text-gold"
                >
                  <span className="inline-block h-px w-5 bg-current" />
                  {label}
                </Link>
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
            <p className="eyebrow mb-6">Discover</p>
            <div className="flex flex-col gap-5">
              {world.map((w) => (
                <Link key={w.path} href={w.path} className="group no-underline">
                  <p className="font-heading text-[13px] tracking-widest text-ivory transition-colors duration-300 group-hover:text-gold">
                    {w.label}
                  </p>
                </Link>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <p className="eyebrow mb-6">From the Journal</p>
            <Link
              href="/journal"
              className="relative block overflow-hidden rounded-sm no-underline"
            >
              <Image
                src="https://images.unsplash.com/photo-1678287714479-adaa0cfbe6c6?w=700&h=220&fit=crop&auto=format"
                alt="Heritage"
                width={700}
                height={180}
                className="block h-45 w-full object-cover brightness-[0.55]"
              />
              <div className="absolute inset-0 flex flex-col justify-end px-6 py-5">
                <p className="eyebrow">Journal</p>
                <p className="mt-1.5 font-heading text-base text-ivory">
                  The Alchemy of Ancient Egyptian Perfumery
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {activeMenu && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-998 hidden bg-black/50 lg:block"
          onClick={closeMenu}
        />
      )}
    </>
  );
}
