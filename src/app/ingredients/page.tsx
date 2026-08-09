import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import Reveal from "@/src/components/animation/Reveal";
import IngredientExplorer from "@/src/components/ingredients/IngredientExplorer";
import {
  getIngredientDetails,
  getIngredientFamilies,
} from "@/src/services/content";

/** ISR, 1 hour — editorial copy, aligned with the other content routes. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Ingredients",
  description:
    "Oud, frankincense, saffron, neroli, ambergris, and black iris — the rare natural materials behind every KHEM fragrance, and where each one comes from.",
  alternates: { canonical: "/ingredients" },
  openGraph: {
    title: "Ingredients | Nature's Finest",
    description:
      "The raw materials of KHEM: their origin, olfactive family, rarity, and the perfumes they build.",
  },
};

export default async function Ingredients() {
  const [ingredients, families] = await Promise.all([
    getIngredientDetails(),
    getIngredientFamilies(),
  ]);

  return (
    <div className="min-h-screen bg-background text-ivory">
      {/* ── HERO ───────────────────────────────────── */}
      <section className="relative flex h-[80vh] min-h-150 items-center overflow-hidden bg-black">
        <Image
          src="https://images.unsplash.com/photo-1615885108069-7d5bef9a7e22?w=1800&h=900&fit=crop&auto=format"
          alt=""
          fill
          priority
          quality={85}
          sizes="100vw"
          className="object-cover brightness-20 saturate-60"
        />
        <div className="absolute inset-0 bg-linear-to-br from-background/95 via-background/70 to-background/40" />

        <div className="relative z-10 max-w-3xl px-6 md:px-20 lg:px-30">
          <p className="eyebrow mb-5">The Raw Materials</p>
          <h1 className="mb-8 font-heading text-5xl font-normal leading-none text-ivory sm:text-7xl md:text-8xl lg:text-9xl">
            Nature&apos;s
            <br />
            <span className="text-gold">Finest</span>
          </h1>
          <div className="gold-line mb-8" />
          <p className="max-w-lg text-sm leading-loose text-ivory/50">
            Every KHEM fragrance begins with an uncompromising commitment to
            ingredient quality. We use only the finest natural raw materials from
            the most prestigious sources on earth.
          </p>
        </div>
      </section>

      {/* ── FILTER + GRID + DETAIL ──────────────────── */}
      <IngredientExplorer ingredients={ingredients} families={families} />

      {/* ── CTA ─────────────────────────────────────── */}
      <section className="border-t border-border bg-surface px-6 py-24 text-center md:px-20 md:py-30">
        <Reveal className="mx-auto max-w-xl">
          <p className="eyebrow mb-5">Experience Them</p>
          <h2 className="mb-5 font-heading text-2xl font-normal text-ivory sm:text-3xl md:text-4xl">
            Rare Ingredients. Living Fragrances.
          </h2>
          <p className="mb-11 text-[13px] leading-loose text-ivory/40">
            Each KHEM fragrance uses these extraordinary materials in
            combinations informed by five thousand years of Egyptian perfumery
            tradition.
          </p>
          <Link href="/collections" className="btn-luxury btn-luxury-fill">
            Discover the Fragrances
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
