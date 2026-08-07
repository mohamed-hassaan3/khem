"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState, type FormEvent } from "react";

/**
 * Inner Circle signup.
 *
 * The email is validated and then discarded — nothing is transmitted or stored
 * yet. See the TODO in `handleSubmit` for the wiring contract.
 */

/** Pragmatic shape check; the authoritative validation must happen server-side. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const EASE_LUXURY: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = email.trim();

    if (!EMAIL_PATTERN.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError(null);

    // TODO: replace with a Server Action that validates `trimmed` with a Zod
    // schema (schemas/newsletter.ts) and hands off to Resend. Until then the
    // address is never persisted or transmitted.
    setIsSubscribed(true);
  }

  if (isSubscribed) {
    return (
      <motion.div
        className="border border-gold bg-gold/5 p-6"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_LUXURY }}
        role="status"
      >
        <p className="font-heading text-sm uppercase tracking-wider text-gold">
          Welcome to the Circle
        </p>
        <p className="mt-2 text-xs text-ivory/40">
          You will receive a confirmation shortly.
        </p>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3 sm:flex-row"
    >
      <div className="flex-1 text-left">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Enter your email address"
          aria-invalid={error !== null}
          aria-describedby={error ? "newsletter-email-error" : undefined}
          className="w-full border border-gold/30 bg-black/40 px-4 py-3 text-xs text-ivory transition-colors placeholder:text-ivory/30 focus:border-gold focus:outline-none"
        />
        {error ? (
          <p
            id="newsletter-email-error"
            className="mt-2 text-[11px] tracking-wide text-danger"
          >
            {error}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        className="h-fit cursor-pointer bg-gold px-8 py-3 font-heading text-xs font-medium uppercase tracking-[0.2em] text-background transition-colors duration-300 ease-out hover:bg-champagne"
      >
        Subscribe
      </button>
    </form>
  );
}
