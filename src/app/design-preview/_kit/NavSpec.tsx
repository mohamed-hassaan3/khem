"use client";

import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useState } from "react";

/**
 * Navigation, in both of the states §23 asks for — and the toggle between them
 * is the point of the specimen.
 *
 * The live header is ivory-on-dark in *both* states, because there is only one
 * ground on the site today. Under the proposed system the header has to change
 * colour when the section beneath it changes: transparent with ivory type over
 * the dark hero, then an ivory bar with near-black type once the page has
 * scrolled onto a light section. Getting that wrong is not a style bug, it is
 * ivory type on an ivory background — so it is worth looking at deliberately
 * rather than trusting a screenshot of one state.
 *
 * A client component only because of the toggle; nothing about the proposal
 * requires client JavaScript beyond the scroll listener the header already has.
 */

const LINKS = ["Collections", "Perfumes", "Heritage", "Journal", "Stockists"];

export default function NavSpec() {
  const [scrolled, setScrolled] = useState(false);
  const [drawer, setDrawer] = useState(false);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="k-sans me-2 text-[9px] font-medium uppercase tracking-[0.22em] text-[var(--k-on-light-muted)]">
          State
        </span>
        {[
          { label: "Over hero", value: false },
          { label: "Scrolled onto light", value: true },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => setScrolled(option.value)}
            aria-pressed={scrolled === option.value}
            className={`k-btn k-btn-sm ${
              scrolled === option.value ? "k-btn-primary" : "k-btn-outline"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden border border-[var(--k-line-light)]">
        {/*
          The page beneath the header, so the two states can be judged against
          the thing they have to sit on. Dark hero for the first, ivory shop
          grid for the second.
        */}
        <div
          className={`absolute inset-0 transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            scrolled ? "k-light" : "k-dark"
          }`}
        />

        <header
          className={`relative z-2 flex h-20 items-center justify-between gap-4 px-5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:px-10 ${
            scrolled
              ? "border-b border-[var(--k-line-light)] bg-[color-mix(in_srgb,var(--k-ivory)_94%,transparent)] text-[var(--k-on-light)] backdrop-blur-xl"
              : "border-b border-transparent bg-transparent text-[var(--k-on-dark)]"
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-6">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center lg:hidden"
            >
              <Menu size={18} strokeWidth={1.25} aria-hidden />
            </button>
            <nav className="hidden items-center gap-7 lg:flex">
              {LINKS.map((link) => (
                <a
                  key={link}
                  href="#0"
                  className={`k-serif relative text-[11px] uppercase tracking-[0.2em] no-underline transition-colors duration-300 ${
                    scrolled
                      ? "text-[var(--k-on-light-muted)] hover:text-[var(--k-on-light)]"
                      : "text-[rgba(247,245,240,0.7)] hover:text-[var(--k-on-dark)]"
                  }`}
                >
                  {link}
                </a>
              ))}
            </nav>
          </div>

          <p className="k-serif shrink-0 text-lg tracking-[0.42em]">KHEM</p>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
            {[Search, User].map((Icon, index) => (
              <span
                key={index}
                className="flex h-11 w-11 items-center justify-center"
              >
                <Icon size={17} strokeWidth={1.25} aria-hidden />
              </span>
            ))}
            <span className="relative flex h-11 w-11 items-center justify-center">
              <ShoppingBag size={17} strokeWidth={1.25} aria-hidden />
              <span
                className={`k-sans absolute end-1.5 top-1.5 grid min-w-4 place-items-center rounded-full px-1 text-[9px] leading-4 ${
                  scrolled
                    ? "bg-[var(--k-obsidian)] text-[var(--k-ivory)]"
                    : "bg-[var(--k-gold)] text-[var(--k-obsidian)]"
                }`}
              >
                2
              </span>
            </span>
          </div>
        </header>

        {/* Enough page below the bar to see the contrast relationship. */}
        <div className="relative z-1 flex h-52 items-center px-5 lg:px-10">
          {scrolled ? (
            <div className="w-full">
              <p className="k-eyebrow">Signature Collection</p>
              <p className="k-serif mt-3 text-2xl tracking-[0.08em] text-[var(--k-on-light)]">
                Twelve fragrances
              </p>
            </div>
          ) : (
            <div className="w-full">
              <p className="k-eyebrow">Essence of Heritage</p>
              <p className="k-serif mt-3 text-2xl tracking-[0.12em] text-[var(--k-on-dark)] sm:text-3xl">
                Five millennia, one flacon
              </p>
            </div>
          )}
        </div>

        {/* ── Mobile drawer ── */}
        {drawer ? (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setDrawer(false)}
              className="absolute inset-0 z-3 cursor-default bg-[rgba(13,13,13,0.6)]"
            />
            <aside className="k-charcoal absolute bottom-0 start-0 top-0 z-4 w-[280px] max-w-[80%] overflow-y-auto border-e border-[var(--k-line-dark)]">
              <div className="flex h-20 items-center justify-between px-6">
                <p className="k-eyebrow">Menu</p>
                <button
                  type="button"
                  onClick={() => setDrawer(false)}
                  aria-label="Close menu"
                  className="flex h-11 w-11 cursor-pointer items-center justify-center text-[var(--k-on-dark-muted)]"
                >
                  <X size={18} strokeWidth={1.25} aria-hidden />
                </button>
              </div>
              <nav className="flex flex-col gap-5 px-6 pb-10">
                {LINKS.map((link) => (
                  <a
                    key={link}
                    href="#0"
                    className="k-serif text-sm uppercase tracking-[0.2em] text-[var(--k-on-dark)] no-underline"
                  >
                    {link}
                  </a>
                ))}
                <div className="k-rule my-2" />
                <a
                  href="#0"
                  className="k-sans text-[11px] uppercase tracking-[0.2em] text-[var(--k-on-dark-muted)] no-underline"
                >
                  Account
                </a>
              </nav>
            </aside>
          </>
        ) : null}
      </div>
    </div>
  );
}
