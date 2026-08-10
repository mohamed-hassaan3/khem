"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { interpolate } from "@/src/lib/i18n/interpolate";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { Testimonial } from "@/src/types/content";

/**
 * Auto-advancing testimonial crossfade.
 *
 * Data arrives as a prop from the Server Component page — this component never
 * imports the service layer, keeping the query on the server.
 */

const ROTATION_MS = 5000;
const CROSSFADE_SECONDS = 1;

export interface TestimonialCarouselProps {
  testimonials: Testimonial[];
}

export default function TestimonialCarousel({
  testimonials,
}: TestimonialCarouselProps) {
  const dict = useDictionary();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);

  useEffect(() => {
    // Nothing to rotate through, or the user is interacting with the control.
    if (isPaused || testimonials.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((index) => (index + 1) % testimonials.length);
    }, ROTATION_MS);

    return () => clearInterval(timer);
  }, [isPaused, testimonials.length]);

  if (testimonials.length === 0) return null;

  return (
    <div
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
    >
      <div
        className="relative flex min-h-[160px] items-center justify-center"
        aria-live="polite"
        aria-atomic="true"
      >
        {testimonials.map((testimonial, index) => {
          const isActive = index === activeIndex;

          return (
            <motion.figure
              key={testimonial.id}
              className="absolute inset-0 m-0 flex flex-col items-center justify-center"
              animate={{ opacity: isActive ? 1 : 0 }}
              transition={{
                duration: prefersReducedMotion ? 0 : CROSSFADE_SECONDS,
                ease: "easeInOut",
              }}
              // Hidden slides must not be reachable by pointer or screen reader.
              style={{ pointerEvents: isActive ? "auto" : "none" }}
              aria-hidden={!isActive}
            >
              <blockquote className="mb-6 font-heading text-lg italic leading-relaxed text-ivory sm:text-xl md:text-2xl">
                &quot;{testimonial.quote}&quot;
              </blockquote>
              <figcaption>
                <p className="mb-1 font-heading text-xs uppercase tracking-[0.15em] text-gold">
                  {testimonial.author}
                </p>
                <p className="text-[11px] uppercase tracking-wider text-ivory/35">
                  {testimonial.authorTitle}
                </p>
              </figcaption>
            </motion.figure>
          );
        })}
      </div>

      <div className="mt-12 flex justify-center gap-2">
        {testimonials.map((testimonial, index) => (
          <button
            key={testimonial.id}
            type="button"
            aria-label={interpolate(dict.testimonials.showFrom, {
              author: testimonial.author,
            })}
            aria-current={index === activeIndex}
            onClick={() => setActiveIndex(index)}
            className={`h-0.5 cursor-pointer transition-all duration-500 ease-out ${
              index === activeIndex ? "w-7 bg-gold" : "w-2 bg-gold/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
