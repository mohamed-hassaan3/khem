"use client";

import { Fragment } from "react";

import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * "Contact — Delivery — Payment", each step gold once it is filled in.
 *
 * The same visual-only completeness the step circles use (Stage 2 D10): it
 * says how far along the form is, it does not validate anything.
 */
export default function CheckoutProgress({
  contactComplete,
  deliveryComplete,
  className = "",
}: {
  contactComplete: boolean;
  deliveryComplete: boolean;
  className?: string;
}) {
  const dict = useDictionary();
  const steps = [
    { label: dict.checkout.steps.contact, done: contactComplete },
    { label: dict.checkout.steps.delivery, done: deliveryComplete },
    { label: dict.checkout.steps.payment, done: false },
  ];

  return (
    <ol
      aria-label={dict.checkout.progressLabel}
      className={`flex flex-wrap items-center gap-2 pb-1 text-[10px] uppercase tracking-[0.16em] text-ground-muted ${className}`}
    >
      {steps.map((step, index) => (
        <Fragment key={step.label}>
          {index > 0 ? (
            <li aria-hidden="true" className="text-ground-border">
              —
            </li>
          ) : null}
          <li
            className={`transition-colors duration-500 ease-luxury-bezier ${
              step.done ? "text-ground-accent" : ""
            }`}
          >
            {step.label}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
