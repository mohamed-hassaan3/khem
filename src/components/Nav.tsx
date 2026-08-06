"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { world, collections } from "../constants/navigation-pages";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const pathname = usePathname();

  const activeMenu = menuPath === pathname ? menuOpen : null;
  const navSolid = scrolled || activeMenu !== null;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleMenuToggle = (menu: string) => {
    setMenuPath(pathname);
    setMenuOpen((prev) => (prev === menu ? null : menu));
  };

  const closeMenu = () => {
    setMenuOpen(null);
    setMenuPath(pathname);
  };

  return (
    <>
      <nav
        className={[
          "fixed inset-x-0 top-0 z-[1000] flex h-20 items-center justify-between px-12 transition-all duration-500",
          "ease-[var(--ease-luxury-bezier)]",
          navSolid
            ? "border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_96%,transparent)] backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
        ].join(" ")}
      >
        <div className="flex flex-1 items-center gap-9">
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

        <Link
          href="/"
          className="flex shrink-0 items-center no-underline"
          onClick={closeMenu}
        >
          <Image
            src="logo/name-logo-transparent.svg"
            alt="KHEM Perfumes"
            width={1273}
            height={540}
            priority
            className="h-14 w-auto"
          />
        </Link>

        <div className="flex flex-1 items-center justify-end gap-7">
          <button type="button" className="nav-link" aria-label="Search">
            <svg
              width="17"
              height="17"
              viewBox="0 0 17 17"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <circle cx="7.5" cy="7.5" r="5.5" />
              <line x1="11.5" y1="11.5" x2="16" y2="16" />
            </svg>
          </button>
          <Link href="/wishlist" className="nav-link" aria-label="Wishlist">
            <svg
              width="17"
              height="17"
              viewBox="0 0 17 17"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <path d="M8.5 14.5s-6-4.2-6-8a4 4 0 0 1 6-3.46A4 4 0 0 1 14.5 6.5c0 3.8-6 8-6 8z" />
            </svg>
          </Link>
          <Link href="/account" className="nav-link" aria-label="Account">
            <svg
              width="17"
              height="17"
              viewBox="0 0 17 17"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <circle cx="8.5" cy="5.5" r="3" />
              <path d="M1.5 15.5a7 7 0 0 1 14 0" />
            </svg>
          </Link>
        </div>
      </nav>

      <div
        className={`mega-menu ${activeMenu === "collections" ? "open" : ""}`}
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
        className={`mega-menu ${activeMenu === "world" ? "open" : ""}`}
        onMouseLeave={closeMenu}
      >
        <div className="mx-auto grid max-w-300 grid-cols-3 gap-12">
          <div>
            <p className="eyebrow mb-6">Discover</p>
            <div className="flex flex-col gap-5">
              {world.map((w) => (
                <Link
                  key={w.path}
                  href={w.path}
                  className="group no-underline"
                >
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
          className="fixed inset-0 z-998 bg-black/50"
          onClick={closeMenu}
        />
      )}
    </>
  );
}
