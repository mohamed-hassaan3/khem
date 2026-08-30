import type { LucideIcon } from "lucide-react";

import Reveal from "@/src/components/animation/Reveal";

/**
 * A three-up band of short editorial statements — Server Component.
 *
 * Two variants, because the two pages that need one differ in register rather
 * than in structure:
 *
 *  - `band` — `/body-care`'s ritual principles: centred, icon-led, quiet.
 *  - `steps` — `/discovery`'s promise: numbered, left-aligned, sequential.
 *
 * Icons arrive as Lucide components, never as strings or glyphs: the original
 * SPA drew these with `✦ ◆ ◇`, which render as tofu in fonts that lack them and
 * are announced as punctuation by a screen reader.
 *
 * The name says three, but nothing here is fixed at three — the grid is
 * `md:grid-cols-3` over whatever it is handed.
 */

export interface FeatureItem {
  icon: LucideIcon;
  title: string;
  body: string;
}

export interface FeatureTriptychProps {
  items: readonly FeatureItem[];
  variant?: "band" | "steps";
  /** Optional heading block, used by the `steps` variant. */
  eyebrow?: string;
  heading?: string;
}

export default function FeatureTriptych({
  items,
  variant = "band",
  eyebrow,
  heading,
}: FeatureTriptychProps) {
  if (items.length === 0) return null;

  if (variant === "steps") {
    return (
      <section className="border-t border-ground-border px-4 py-14 sm:px-6 md:px-10 lg:px-12 xl:px-16 md:py-30">
        <div className="mx-auto max-w-350">
          {eyebrow || heading ? (
            <Reveal className="mb-10 md:mb-16 text-center">
              {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
              {heading ? (
                <h2 className="font-heading text-3xl font-normal text-ground sm:text-4xl">
                  {heading}
                </h2>
              ) : null}
            </Reveal>
          ) : null}

          <ol className="grid list-none grid-cols-1 gap-px bg-border md:grid-cols-3">
            {items.map((item, index) => {
              const Icon = item.icon;

              return (
              <li key={item.title} className="bg-ivory">
                <Reveal delay={index * 0.1} className="h-full px-4 py-12 md:px-12 md:py-14">
                  <p className="mb-7 flex items-center gap-3 font-heading text-[10px] tracking-[0.2em] text-gold/35">
                    <Icon
                      size={16}
                      strokeWidth={1.25}
                      aria-hidden="true"
                      className="text-ground-accent/70"
                    />
                    {String(index + 1).padStart(2, "0")}
                  </p>

                  <div className="gold-line mb-6 w-10" />

                  <h3 className="mb-4 font-heading text-lg font-normal text-ground">
                    {item.title}
                  </h3>

                  <p className="text-[13px] leading-loose text-ground-muted">
                    {item.body}
                  </p>
                </Reveal>
              </li>
              );
            })}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section className="ground-sand border-b border-ground-border px-4 py-15 md:px-20">
      <div className="mx-auto grid max-w-350 grid-cols-1 gap-6 md:gap-12 md:grid-cols-3">
        {items.map((item, index) => {
          const Icon = item.icon;

          return (
            <Reveal key={item.title} delay={index * 0.1} className="text-center">
              <Icon
                size={20}
                strokeWidth={1.25}
                aria-hidden="true"
                className="mx-auto mb-4 text-ground-accent"
              />

              <p className="mb-2.5 font-heading text-sm tracking-[0.08em] text-ground">
                {item.title}
              </p>

              <p className="text-xs leading-loose text-ground-muted">{item.body}</p>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
