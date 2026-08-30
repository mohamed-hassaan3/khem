import { Star } from "lucide-react";

import { COMMENT_MAX_RATING } from "@/src/schemas/comments";

/**
 * A rating, rendered.
 *
 * Carries no directive and calls no hook, for the same reason `<CommentRow>`
 * does not: it is rendered on the server inside a stored comment row and on the
 * client inside the form's optimistic copy, and one piece of markup for both is
 * what keeps the two from drifting.
 *
 * The interactive half lives in `<StarRatingInput>`. Splitting them is what
 * keeps a static row of five stars from shipping a hover state's worth of
 * JavaScript for every comment in a thread.
 *
 * A single `role="img"` with a number in its label, not five icons: a screen
 * reader should say "4 out of 5", not "star star star star star".
 */

export interface StarRatingProps {
  /** 1–5. Fractions are rounded for the fill; the label keeps the precision. */
  value: number;
  /** Accessible name, already interpolated — "4 out of 5". */
  label: string;
  /** Icon edge in pixels. */
  size?: number;
  className?: string;
}

export default function StarRating({
  value,
  label,
  size = 14,
  className = "",
}: StarRatingProps) {
  const filled = Math.round(value);

  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex items-center gap-1 ${className}`}
    >
      {Array.from({ length: COMMENT_MAX_RATING }, (_, index) => {
        const isFilled = index < filled;

        return (
          <Star
            key={index}
            size={size}
            strokeWidth={1.25}
            aria-hidden="true"
            className={
              isFilled ? "fill-gold text-ground-accent" : "fill-none text-ground-muted/60"
            }
          />
        );
      })}
    </span>
  );
}
