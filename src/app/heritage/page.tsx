import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import Reveal from "@/src/components/animation/Reveal";
import { getBrandValues, getTimeline } from "@/src/services/content";

/** ISR, 1 hour — editorial copy, aligned with the other content routes. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Our Heritage",
  description:
    "KHEM takes its name from Kemet, the ancient Egyptian name for the Black Land. Five thousand years of Egyptian perfumery, from the first kyphi to the Noir chapter.",
  alternates: { canonical: "/heritage" },
  openGraph: {
    title: "Our Heritage | The Land of Black Earth",
    description:
      "A timeline of scent spanning five millennia — from temple kyphi and the Ebers Papyrus to the founding of KHEM in Cairo.",
  },
};

/** Stagger step between siblings, in seconds. */
const STAGGER_STEP = 0.1;

/**
 * The two halves of a timeline entry, defined once and placed on either side of
 * the rail depending on the row's parity.
 */
function TimelineYear({
  year,
  className = "",
}: {
  year: string;
  className?: string;
}) {
  return (
    <p
      className={`font-heading text-xl font-semibold text-gold ${className}`.trim()}
    >
      {year}
    </p>
  );
}

function TimelineCopy({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <h3 className="mb-3 font-heading text-[15px] font-normal text-ivory">
        {title}
      </h3>
      <p className="text-[13px] leading-relaxed text-ivory/45">{description}</p>
    </>
  );
}

export default async function Heritage() {
  const [timeline, values] = await Promise.all([
    getTimeline(),
    getBrandValues(),
  ]);

  return (
    <div className="min-h-screen bg-background text-ivory">
      {/* ── HERO ───────────────────────────────────── */}
      <section className="relative flex h-screen min-h-150 items-center overflow-hidden bg-black">
        <Image
          src="https://images.unsplash.com/photo-1678287714479-adaa0cfbe6c6?w=1800&h=1000&fit=crop&auto=format"
          alt=""
          fill
          priority
          quality={85}
          sizes="100vw"
          className="object-cover brightness-30 saturate-50"
        />
        <div className="absolute inset-0 bg-linear-to-r from-background/95 via-background/70 to-background/30" />

        <div className="relative z-10 max-w-2xl px-6 md:px-20 lg:px-30">
          <p className="eyebrow mb-5">Our Heritage</p>
          <h1 className="mb-8 font-heading text-5xl font-normal leading-none text-ivory sm:text-6xl md:text-7xl lg:text-8xl">
            The Land of
            <br />
            <span className="text-gold">Black Earth</span>
          </h1>
          <div className="gold-line mb-8" />
          <p className="max-w-lg text-sm leading-loose text-ivory/55">
            KHEM takes its name from Kemet — the ancient Egyptian name for Egypt
            itself, meaning &ldquo;the Black Land&rdquo; — a reference to the
            fertile dark soil left by the Nile&apos;s annual flood. In this
            spirit, we cultivate something extraordinary from the richest
            cultural soil in human history.
          </p>
        </div>
      </section>

      {/* ── PHILOSOPHY ──────────────────────────────── */}
      <section className="bg-background px-6 py-24 md:px-20 md:py-36">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_2fr] lg:gap-25">
          <Reveal>
            <p className="eyebrow mb-6">Philosophy</p>
            <div className="section-divider mx-0 h-25" />
          </Reveal>

          <Reveal delay={STAGGER_STEP * 2}>
            <h2 className="mb-10 font-heading text-2xl font-normal leading-snug text-ivory sm:text-3xl lg:text-5xl">
              &ldquo;We do not recreate the past. We invoke its spirit within the
              present.&rdquo;
            </h2>
            <p className="mb-6 text-sm leading-loose text-ivory/50">
              Ancient Egypt did not merely use fragrance as adornment. Scent was
              woven into the fabric of spiritual practice, healing, ritual, and
              identity. The temples burned kyphi at sunset. The dead were
              anointed with precious oils. Fragrance was the language of
              divinity.
            </p>
            <p className="text-sm leading-loose text-ivory/50">
              At KHEM, we approach this legacy with reverence. We study ancient
              formulas, work with Egyptologists, source our ingredients from the
              same regions that supplied the ancient perfumers, and apply modern
              perfumery techniques to create something that honors the past
              without being trapped by it.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── QUOTE BAND ──────────────────────────────── */}
      <section className="relative h-[60vh] min-h-100 overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1762530211537-011645caef57?w=1800&h=700&fit=crop&auto=format"
          alt=""
          fill
          sizes="100vw"
          className="object-cover brightness-40 saturate-60"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 px-6 md:px-20">
          <Reveal className="text-center">
            <p className="mx-auto max-w-3xl font-heading text-lg leading-relaxed tracking-widest text-ivory sm:text-2xl md:text-4xl">
              Every hieroglyph was a prayer. Every ritual was a poem. Every scent
              was a bridge between the human and the divine.
            </p>
            <div className="gold-line mx-auto mt-7" />
          </Reveal>
        </div>
      </section>

      {/* ── TIMELINE ────────────────────────────────── */}
      <section className="bg-background px-6 py-24 md:px-20 md:py-36">
        <div className="mx-auto max-w-4xl">
          <Reveal className="mb-16 text-center md:mb-25">
            <p className="eyebrow mb-5">Five Thousand Years</p>
            <h2 className="font-heading text-3xl font-normal text-ivory sm:text-4xl md:text-5xl">
              A Timeline of Scent
            </h2>
          </Reveal>

          <div className="relative">
            {/* Rail: left-hand on mobile, centered from md up. */}
            <div
              className="absolute inset-y-0 left-1.5 w-px bg-linear-to-b from-transparent via-gold/30 to-transparent md:left-1/2 md:-translate-x-1/2"
              aria-hidden="true"
            />

            <ol className="flex flex-col gap-14 md:gap-20">
              {timeline.map((event, index) => {
                // Even entries put the year left of the rail and the copy right;
                // odd entries mirror it. Below `md` every entry is left-railed.
                const yearFirst = index % 2 === 0;

                return (
                  <li key={event.id}>
                    <Reveal
                      delay={(index % 3) * STAGGER_STEP}
                      className="grid grid-cols-[auto_1fr] items-start gap-6 md:grid-cols-[1fr_60px_1fr] md:gap-8"
                    >
                      {/* Left of the rail — desktop only. */}
                      <div className="hidden pt-2 text-right md:block">
                        {yearFirst ? (
                          <TimelineYear year={event.year} />
                        ) : (
                          <TimelineCopy
                            title={event.title}
                            description={event.description}
                          />
                        )}
                      </div>

                      <div className="flex justify-center pt-2" aria-hidden="true">
                        <span className="mt-1.5 h-3 w-3 flex-none rounded-full border-2 border-gold bg-background" />
                      </div>

                      {/* Right of the rail — and the only cell below `md`. */}
                      <div className="md:pt-2">
                        <div className="md:hidden">
                          <TimelineYear year={event.year} className="mb-2" />
                          <TimelineCopy
                            title={event.title}
                            description={event.description}
                          />
                        </div>
                        <div className="hidden md:block">
                          {yearFirst ? (
                            <TimelineCopy
                              title={event.title}
                              description={event.description}
                            />
                          ) : (
                            <TimelineYear year={event.year} />
                          )}
                        </div>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* ── VALUES ──────────────────────────────────── */}
      <section className="border-t border-border bg-surface px-6 py-24 md:px-20 md:py-30">
        <div className="mx-auto max-w-350">
          <Reveal className="mb-16 text-center md:mb-20">
            <p className="eyebrow mb-5">Our Values</p>
            <h2 className="font-heading text-3xl font-normal text-ivory sm:text-4xl md:text-5xl">
              What We Believe
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {values.map((value, index) => (
              <Reveal
                key={value.id}
                delay={index * STAGGER_STEP}
                className="bg-background p-10 md:p-12"
              >
                <div className="gold-line mb-8" />
                <h3 className="mb-5 font-heading text-xl font-normal text-ivory">
                  {value.title}
                </h3>
                <p className="text-[13px] leading-loose text-ivory/45">
                  {value.description}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section className="bg-background px-6 py-24 text-center md:px-20 md:py-30">
        <Reveal className="mx-auto max-w-xl">
          <p className="eyebrow mb-5">Explore Our World</p>
          <h2 className="mb-10 font-heading text-2xl font-normal text-ivory sm:text-3xl md:text-4xl">
            Begin Your Journey
          </h2>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/collections" className="btn-luxury btn-luxury-fill">
              Shop Collections
            </Link>
            <Link href="/craftsmanship" className="btn-luxury">
              Our Craftsmanship
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
