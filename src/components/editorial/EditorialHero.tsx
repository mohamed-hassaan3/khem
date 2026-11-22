import Image from "next/image";
import type { ReactNode } from "react";

/**
 * The masthead of the editorial pages — `/about`, `/heritage`,
 * `/craftsmanship`, `/ingredients`. Server Component.
 *
 * These four used to carry the same JSX and the same thirty-line comment,
 * copied page to page. The composition is one decision, so it lives once.
 *
 * ## Two compositions, one markup
 *
 * **md and up** — the photograph fills the banner and the type sits over its
 * light side behind the house scrim, exactly as before this component existed.
 *
 * **Phones** — the photograph is a 4:3 band and the type sits *beneath* it, on
 * the page ground. At 390px the photograph is the whole width of the screen,
 * so there is no light side for the type to sit on: the scrim could only
 * flatten the picture or let the heading run onto it (on `/about` the word
 * "of" vanished into black marble). Image first, words second is also how the
 * Stage 2 collection and product pages read on a phone.
 *
 * No top padding or header clearance: the `[locale]` layout reserves
 * `--header-h` for the whole document.
 *
 * The image is the route's LCP element, so it is eager and high priority, and
 * its box is fixed in both compositions — nothing moves when it decodes.
 */

export interface EditorialHeroProps {
  image: { src: string; alt: string };
  eyebrow: string;
  /** The display heading's two lines; the second is set in the accent colour. */
  lines: readonly [string, string];
  lede: string;
  /** Which house scrim the desktop composition uses. */
  scrim?: "column" | "center";
  /** Desktop height of the banner. */
  size?: "standard" | "tall" | "short";
  /** Overlay furniture shown from md up only (e.g. a scroll hint). */
  children?: ReactNode;
}

const DESKTOP_HEIGHT: Record<NonNullable<EditorialHeroProps["size"]>, string> = {
  standard: "md:h-[70vh] md:min-h-165",
  tall: "md:h-[72vh] md:min-h-175",
  short: "md:h-[60vh] md:min-h-140",
};

export default function EditorialHero({
  image,
  eyebrow,
  lines,
  lede,
  scrim = "column",
  size = "standard",
  children,
}: EditorialHeroProps) {
  return (
    <section
      className={`ground-ivory relative overflow-hidden md:flex md:items-center md:bg-sand ${DESKTOP_HEIGHT[size]}`}
    >
      <div className="relative aspect-4/3 w-full overflow-hidden bg-sand md:absolute md:inset-0 md:aspect-auto">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          className="object-cover"
        />
        {/* Phone: a short fade so the band settles into the ground below it. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-ground-bg to-transparent md:hidden"
        />
      </div>

      <div
        aria-hidden="true"
        className={`banner-scrim hidden md:block ${
          scrim === "center" ? "banner-scrim-center" : "banner-scrim-column"
        }`}
      />

      <div className="relative z-10 max-w-2xl px-4 pb-12 pt-6 sm:px-6 md:max-w-3xl md:px-20 md:py-0 lg:max-w-4xl lg:px-30">
        <p className="eyebrow mb-4 rtl:mb-6 md:mb-5 md:rtl:mb-9">{eyebrow}</p>
        <h1 className="mb-6 font-heading text-4xl font-normal leading-[1.05] text-ground sm:text-5xl md:mb-8 md:text-6xl md:leading-none rtl:leading-[1.3] md:rtl:leading-[1.25] lg:text-7xl xl:text-8xl">
          {lines[0]}
          <br />
          <span className="text-ground-accent">{lines[1]}</span>
        </h1>
        <div className="gold-line mb-6 md:mb-8" />
        <p className="max-w-lg text-sm leading-loose text-ground-muted">
          {lede}
        </p>
      </div>

      {children ? <div className="hidden md:contents">{children}</div> : null}
    </section>
  );
}
