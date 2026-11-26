/*
 * Shared by Server and Client Components alike, which is why it is not in
 * `Reveal.tsx`: that module is `"use client"`, and a Server Component may
 * render a client component but cannot call a client function.
 */

/**
 * The delay for the `index`-th card of a grid.
 *
 * One rule for every grid on the site (products, journal entries, collection
 * tiles, stockists): 80 ms a step, restarting every four, so a row arrives
 * left to right and the fifth card never waits behind the first four. The
 * distance and duration themselves live in `globals.css` (`.reveal`), where
 * they differ for phones and wider screens.
 */
export function revealStagger(index: number): number {
  return (index % 4) * 0.08;
}
