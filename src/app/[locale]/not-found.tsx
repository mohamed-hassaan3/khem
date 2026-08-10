import Image from "next/image";
import Link from "next/link";

import logo from "@/public/logo/logo-transparent.svg";

/**
 * 404 page.
 *
 * `not-found.tsx` cannot export `metadata` — the title comes from the root
 * layout's template.
 *
 * The height is `100vh` minus the 5rem Nav rather than `100vh` plus 5rem of
 * padding, so the page fills the viewport instead of overflowing it.
 */
export default function NotFound() {
  return (
    <div className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_color-mix(in_srgb,var(--color-gold)_4%,transparent)_0%,_transparent_60%)]"
        aria-hidden="true"
      />

      {/* Decorative rings */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-100 w-100 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/5 sm:h-175 sm:w-175" />
        <div className="absolute left-1/2 top-1/2 h-150 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/3 sm:h-250 sm:w-250" />
      </div>

      <div className="relative z-10">
        <div className="mb-10 flex justify-center opacity-40">
          <Image src={logo} width={40} height={40} alt="" aria-hidden="true" />
        </div>

        <p
          className="font-heading text-8xl font-bold leading-none text-gold/12 sm:text-9xl lg:text-[160px]"
          aria-hidden="true"
        >
          404
        </p>

        <h1 className="mb-5 font-heading text-2xl font-normal tracking-widest text-ivory sm:text-3xl md:text-4xl">
          Page Not Found
        </h1>

        <div className="gold-line mx-auto mb-7" />

        <p className="mx-auto mb-12 max-w-100 text-sm leading-loose text-ivory/40">
          The page you are seeking has slipped beyond our grasp — like perfume
          dispersing into warm air.
        </p>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link href="/" className="btn-luxury btn-luxury-fill">
            Return Home
          </Link>
          <Link href="/collections" className="btn-luxury">
            Explore Collections
          </Link>
        </div>
      </div>
    </div>
  );
}