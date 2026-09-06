import Image from "next/image";

import fullLogo from "@/public/logo/full-logo-transparent.webp";
import { en } from "@/src/lib/i18n/dictionaries/en";
import { PRELAUNCH_FILM_SRC } from "@/src/lib/prelaunch";

import PrelaunchFilm from "./PrelaunchFilm";
import PrelaunchPanels from "./PrelaunchPanels";

/**
 * ⚠️ TEMPORARY — the pre-launch cover. Server Component.
 *
 * A single screen: light in motion, the house mark, one line of type, and two
 * doors. Nothing scrolls, nothing sells, and nothing here is a component the
 * storefront also uses — deleting `src/components/prelaunch/` removes the whole
 * surface without touching a shared file.
 *
 * ## The hierarchy, and where it comes from
 *
 * §5 asks for KHEM / ESSENCE OF HERITAGE / COMING SOON, and forbids rebuilding
 * the logo out of text or CSS. Two of those three lines are already *inside*
 * `full-logo-transparent.webp` — the artwork is falcon, wordmark and tagline
 * stacked, which is why `CinematicIntro` can stage three beats from one image.
 * So the asset supplies the first two lines and only the third is set as type.
 * Setting "KHEM" in Cinzel underneath the mark would be the house's name typed
 * out twice, in a typeface that is not the one the mark is drawn in.
 *
 * ## Light, not dark
 *
 * `globals.css` opens by saying KHEM is *one light environment*, and the cover
 * is held to that: ivory ground, charcoal type, gold as jewellery. The obsidian
 * tokens still in AGENTS.md §3 describe the site as it was before the redesign
 * and must not be reached for here — a dark Coming Soon card would be the one
 * screen on the domain that contradicts the brand it announces.
 *
 * Consequently every piece of type is `--color-ink` on a veiled light field
 * (13:1), and the one gold that appears as text is `--color-gold-deep` (4.9:1).
 * Plain `--color-gold` is used only for the hairline rule and the underline
 * sweep, where 2.6:1 is a decorative line rather than a word to be read.
 *
 * ## Layout
 *
 * `100svh`, not `100vh`: on a phone the large viewport unit is measured against
 * a collapsed browser chrome that is not collapsed on arrival, so `100vh` puts
 * the last CTA under the address bar. The bottom padding floors at
 * `env(safe-area-inset-bottom)` so the column clears the home indicator.
 *
 * **Top-anchored, not centred**, and that is a fix rather than a preference. The
 * slot below COMING SOON changes height when a panel opens — five links are
 * taller than two invitations — and a vertically centred column answers that by
 * moving *everything*, so pressing World of KHEM slid the logo 95px up the
 * screen. Anchored to a viewport-relative top offset, the mark and the headline
 * hold still and the panel grows downward into space the composition already
 * had. `clamp()` keeps the offset from collapsing on a short window.
 */
export default function PrelaunchCover() {
  return (
    <main className="relative isolate flex min-h-svh flex-col items-center justify-start overflow-hidden px-6 pb-[max(6rem,env(safe-area-inset-bottom))] pt-[clamp(3.5rem,14vh,9rem)] text-center">
      <PrelaunchFilm src={PRELAUNCH_FILM_SRC} />
      {/*
       * The veil goes to full strength only when there is a film behind it.
       * Over the authored light field its luminance is already known and a heavy
       * wash just flattens the ivory-to-sand depth to paper; over an arbitrary
       * video it is what guarantees the type stays readable with no re-tuning.
       * See the two rules in `prelaunch.css`.
       */}
      <div
        className="khem-cover-veil"
        data-film={PRELAUNCH_FILM_SRC === null ? undefined : "true"}
      />

      {/*
       * `relative` lifts the column above the two absolute layers without a
       * `z-index` race: the film and the veil are earlier siblings, so document
       * order settles it. Nothing on this page needs a stacking context of its
       * own, and none is created.
       */}
      <div className="relative flex w-full max-w-184 flex-col items-center">
        {/*
         * The page's only `<h1>`, and it is the mark rather than a string: the
         * accessible name comes from `alt`, so a screen reader hears the house
         * and its line while a sighted visitor sees the artwork. A visually
         * hidden `<h1>` plus a decorative image would say the same thing twice.
         */}
        <h1 className="khem-rise m-0 w-[clamp(232px,58vw,420px)] max-w-full">
          <Image
            src={fullLogo}
            alt="KHEM — The Essence of Heritage"
            priority
            /*
             * A static import, never a string path. A relative `src` resolves
             * against the *directory* of the current URL — the bug documented at
             * length in `Nav.tsx`, where `/ar/logo/…` 404'd through the
             * catch-all on every prefixed route. Importing the asset makes a
             * relative path unrepresentable, and gives the box its intrinsic
             * 2000×1089 before a byte of artwork arrives, so there is no shift.
             */
            sizes="(min-width: 768px) 420px, 72vw"
            className="h-auto w-full"
          />
        </h1>

        <div
          className="khem-rise my-9 h-px w-16 bg-gold/55 sm:my-10"
          style={{ "--rise-delay": "140ms" } as React.CSSProperties}
          aria-hidden="true"
        />

        {/*
         * `text-indent` matched to the tracking. Letter-spacing is applied after
         * the final glyph too, so a centred line with 0.42em tracking sits half
         * a space left of true centre; the indent gives it back. It is the
         * difference between typography and text.
         */}
        <p
          className="khem-rise m-0 font-heading text-[clamp(0.75rem,1.6vw,1rem)] font-medium uppercase tracking-[0.42em] text-ink indent-[0.42em]"
          style={{ "--rise-delay": "260ms" } as React.CSSProperties}
        >
          Coming Soon
        </p>

        <div
          className="khem-rise mt-14 w-full sm:mt-16"
          style={{ "--rise-delay": "400ms" } as React.CSSProperties}
        >
          <PrelaunchPanels
            /*
             * The site's own words, read from the reference dictionary on the
             * server. The cover has no `I18nProvider` above it (see
             * `app/prelaunch/layout.tsx`), and wrapping it in one to reach eight
             * strings would serialise the entire dictionary into the document.
             * Passing the strings keeps the copy in one place at no cost.
             */
            subscribeLabels={{
              placeholder: en.forms.newsletterPlaceholder,
              submit: en.forms.subscribe,
              sending: en.forms.sending,
              invalidEmail: en.forms.invalidEmail,
              rateLimited: en.forms.rateLimited,
              deliveryFailed: en.forms.deliveryFailed,
              successHeading: en.newsletter.successHeading,
              successBody: en.newsletter.successBody,
            }}
          />
        </div>
      </div>

      {/*
       * Absolute, so the column above is centred in the viewport rather than in
       * the space left over after a footer. On a short screen it is the one
       * thing allowed to sit close to the edge.
       */}
      <p
        className="khem-rise absolute inset-x-0 bottom-[max(1.75rem,env(safe-area-inset-bottom))] m-0 text-[0.62rem] uppercase tracking-[0.18em] text-ink-muted"
        style={{ "--rise-delay": "560ms" } as React.CSSProperties}
      >
        © {new Date().getFullYear()} KHEM Fragrance House
      </p>
    </main>
  );
}
