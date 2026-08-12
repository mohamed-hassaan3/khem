"use client";

import { Minus, Plus } from "lucide-react";

/**
 * Controlled −/+ quantity control.
 *
 * Labels are props rather than dictionary lookups: the component holds no i18n
 * dependency, so any future surface (cart line, drawer, admin) can reuse it
 * without inheriting this page's copy.
 */

export interface QuantityStepperProps {
  value: number;
  min?: number;
  /** Upper bound, normally the product's stock. */
  max: number;
  onChange: (next: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
}

export default function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
}: QuantityStepperProps) {
  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <div className="flex w-fit items-center border border-white/10">
      <StepButton
        label={decreaseLabel}
        disabled={!canDecrease}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={14} strokeWidth={1.25} aria-hidden="true" />
      </StepButton>

      <span
        aria-live="polite"
        className="grid size-11 place-items-center font-heading text-sm text-ivory"
      >
        {value}
      </span>

      <StepButton
        label={increaseLabel}
        disabled={!canIncrease}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={14} strokeWidth={1.25} aria-hidden="true" />
      </StepButton>
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 place-items-center text-ivory/50 transition-colors duration-300 ease-out hover:text-gold focus-visible:text-gold focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
