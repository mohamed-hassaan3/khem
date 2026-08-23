"use client";

import { Star } from "lucide-react";
import { useId, useState } from "react";

import { COMMENT_MAX_RATING, COMMENT_MIN_RATING } from "@/src/schemas/comments";

/**
 * Leave a rating without writing one.
 *
 * Five real radio inputs, visually hidden and labelled: the browser then gives
 * arrow-key navigation, a single tab stop for the whole group, and the correct
 * announcement, none of which a row of `<button>`s would have. The stars are
 * the labels, so a click is a label click and needs no handler of its own.
 *
 * Hover and focus preview the score the way a pointer expects — the fill
 * follows the cursor, and leaves it again on exit. That preview is the only
 * state here; the value itself is owned by `<CommentForm>`.
 */

export interface StarRatingInputProps {
  /** 0 when nothing is chosen yet. */
  value: number;
  onChange: (value: number) => void;
  /** Accessible group name. */
  label: string;
  /** `(stars) => "3 out of 5"`, for each option's label. */
  optionLabel: (stars: number) => string;
  /** Accessible name of the reset control, shown once a score is set. */
  clearLabel: string;
  disabled?: boolean;
}

export default function StarRatingInput({
  value,
  onChange,
  label,
  optionLabel,
  clearLabel,
  disabled = false,
}: StarRatingInputProps) {
  const name = useId();
  const [preview, setPreview] = useState(0);

  // The preview wins while the pointer is over the group; the chosen value is
  // what stands the rest of the time.
  const shown = preview > 0 ? preview : value;

  return (
    <div className="flex items-center gap-4">
      <div
        role="radiogroup"
        aria-label={label}
        onMouseLeave={() => setPreview(0)}
        className="flex items-center gap-1.5"
      >
        {Array.from(
          { length: COMMENT_MAX_RATING },
          (_, index) => COMMENT_MIN_RATING + index,
        ).map((stars) => {
          const isFilled = stars <= shown;

          return (
            <label
              key={stars}
              onMouseEnter={() => setPreview(stars)}
              className={`group grid size-8 place-items-center ${
                disabled ? "cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={stars}
                checked={value === stars}
                disabled={disabled}
                onChange={() => onChange(stars)}
                onFocus={() => setPreview(stars)}
                onBlur={() => setPreview(0)}
                aria-label={optionLabel(stars)}
                className="peer sr-only"
              />
              <Star
                size={22}
                strokeWidth={1.25}
                aria-hidden="true"
                className={`transition-colors duration-300 ease-out peer-focus-visible:drop-shadow-[0_0_6px_color-mix(in_srgb,var(--color-gold)_60%,transparent)] ${
                  isFilled ? "fill-gold text-gold" : "fill-none text-ivory/25"
                }`}
              />
            </label>
          );
        })}
      </div>

      {/*
        Only once there is something to clear. A permanently visible reset next
        to an empty row would read as a sixth option.
      */}
      {value > 0 && !disabled ? (
        <button
          type="button"
          onClick={() => {
            onChange(0);
            setPreview(0);
          }}
          className="cursor-pointer font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/30 transition-colors duration-300 ease-out hover:text-gold focus-visible:text-gold focus-visible:outline-none"
        >
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}
