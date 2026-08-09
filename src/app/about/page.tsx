import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import Reveal from "@/src/components/animation/Reveal";
import { getMissionStatements } from "@/src/services/content";

/** ISR, 1 hour — editorial copy, aligned with the other content routes. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About",
  description:
    "KHEM was founded in Cairo in 2019 to create extraordinary fragrances from extraordinary ingredients, inspired by the civilization that gave the world perfume.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About KHEM | A House of Ancient Futures",
    description:
      "The founders, the mission, and the vision behind KHEM — a luxury Egyptian fragrance house bridging five millennia of perfumery and the modern world.",
  },
};

/** Stagger step between grid children, in seconds. */
const STAGGER_STEP = 0.1;

export default async function About() {
  const missionStatements = await getMissionStatements();

  return (
    <div className="min-h-screen bg-background text-ivory">
      {/* ── HERO ───────────────────────────────────── */}
      <section className="relative flex h-screen min-h-150 items-center overflow-hidden bg-black">
        <Image
          src="https://images.unsplash.com/photo-1747696766706-5485b39bf358?w=1800&h=1000&fit=crop&auto=format"
          alt=""
          fill
          priority
          quality={85}
          sizes="100vw"
          className="object-cover brightness-[0.25] saturate-50"
        />
        <div className="absolute inset-0 bg-linear-to-r from-background/90 via-background/60 to-transparent" />

        <div className="relative z-10 max-w-2xl px-6 md:px-20 lg:px-30">
          <p className="eyebrow mb-5">About KHEM</p>
          <h1 className="mb-8 font-heading text-5xl font-normal leading-none text-ivory sm:text-6xl md:text-7xl lg:text-8xl">
            A House of
            <br />
            <span className="text-gold">Ancient Futures</span>
          </h1>
          <div className="gold-line mb-8" />
          <p className="max-w-lg text-sm leading-loose text-ivory/50">
            KHEM was founded in Cairo in 2019 with a single mission: to create
            the world&apos;s most extraordinary fragrances using the most
            extraordinary ingredients, inspired by the most extraordinary
            civilization in human history.
          </p>
        </div>
      </section>

      {/* ── FOUNDERS ────────────────────────────────── */}
      <section className="bg-background px-6 py-24 md:px-20 md:py-36">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal className="relative aspect-4/5 w-full overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1738664926482-1a986adb3e6c?w=700&h=800&fit=crop&auto=format"
              alt="The KHEM founders in the atelier"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover brightness-60 saturate-50"
            />
          </Reveal>

          <Reveal delay={STAGGER_STEP * 2}>
            <p className="eyebrow mb-5">The Founders</p>
            <h2 className="mb-8 font-heading text-2xl font-normal leading-snug text-ivory sm:text-3xl md:text-4xl">
              Mohamed Hassaan &amp; Dr. Karim Mansour
            </h2>
            <div className="gold-line mb-8" />
            <p className="mb-5 text-sm leading-loose text-ivory/50">
              Mohamed Hassaan is an award-winning perfumer trained in Grasse with
              twenty years of experience creating for the world&apos;s finest
              houses. Dr. Karim Mansour is an Egyptologist and cultural historian
              at Cairo University, with particular expertise in ancient Egyptian
              ritual practices.
            </p>
            <p className="mb-10 text-sm leading-loose text-ivory/50">
              Together, they met at an exhibition on ancient Egyptian cosmetics
              in 2017. &ldquo;We both understood immediately,&rdquo; Mohamed
              recalls, &ldquo;that this was the most profound fragrance tradition
              in human history — and that nobody had yet done it justice.&rdquo;
            </p>

            <blockquote className="border-l-2 border-gold pl-6">
              <p className="mb-3 font-heading text-base italic leading-relaxed text-ivory">
                &ldquo;We are not recreating history. We are translating it into
                a language the present can feel.&rdquo;
              </p>
              <cite className="text-[11px] not-italic tracking-widest text-gold/60">
                — Mohamed Hassaan, Co-Founder
              </cite>
            </blockquote>
          </Reveal>
        </div>
      </section>

      {/* ── MISSION & VISION ────────────────────────── */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-350 grid-cols-1 md:grid-cols-2">
          {missionStatements.map((item, index) => (
            <Reveal
              key={item.id}
              delay={index * STAGGER_STEP}
              className={
                index === 0
                  ? "border-b border-border p-10 md:border-b-0 md:border-r md:p-20"
                  : "p-10 md:p-20"
              }
            >
              <p className="eyebrow mb-6">{item.label}</p>
              <h2 className="mb-7 font-heading text-2xl font-normal text-ivory sm:text-3xl">
                {item.title}
              </h2>
              <div className="gold-line mb-7" />
              <p className="text-sm leading-loose text-ivory/50">{item.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section className="bg-background px-6 py-24 text-center md:px-20 md:py-30">
        <Reveal className="mx-auto max-w-xl">
          <h2 className="mb-10 font-heading text-2xl font-normal text-ivory sm:text-3xl md:text-4xl">
            Experience KHEM
          </h2>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/collections" className="btn-luxury btn-luxury-fill">
              Shop Now
            </Link>
            <Link href="/heritage" className="btn-luxury">
              Our Heritage
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
