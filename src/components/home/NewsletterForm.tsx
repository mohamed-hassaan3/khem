"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState, useTransition, type FormEvent } from "react";

import { subscribeToNewsletter } from "@/src/actions/newsletter";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";

/**
 * Inner Circle signup.
 *
 * The address is emailed to the house mailbox by `actions/newsletter.ts`. It is
 * deliberately *not* subscribed to anything: no audience, no double opt-in, no
 * row anywhere. A human reads the notification and adds it — which is why the
 * success copy promises a confirmation "shortly" rather than immediately.
 */

/** Pragmatic shape check; the authoritative validation must happen server-side. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const EASE_LUXURY: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function NewsletterForm() {
  const dict = useDictionary();
  /** Sent with the signup so the welcome arrives in this language. */
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isPending, startTransition] = useTransition();
  /** Honeypot — see `ContactForm.tsx` for why it is off-screen, not hidden. */
  const [company, setCompany] = useState("");
  const prefersReducedMotion = useReducedMotion();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) return;

    const trimmed = email.trim();

    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(dict.forms.invalidEmail);
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await subscribeToNewsletter({
        email: trimmed,
        company,
        locale,
      });

      if (result.ok) {
        setIsSubscribed(true);
        return;
      }

      setError(
        result.error === "rateLimited"
          ? dict.forms.rateLimited
          : result.error === "validation"
            ? dict.forms.invalidEmail
            : dict.forms.deliveryFailed,
      );
    });
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
          {dict.newsletter.successHeading}
        </p>
        <p className="mt-2 text-xs text-ivory/40">
          {dict.newsletter.successBody}
        </p>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="relative flex flex-col gap-3 sm:flex-row"
    >
      <div className="flex-1 text-start">
        <label htmlFor="newsletter-email" className="sr-only">
          {dict.forms.email}
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
          placeholder={dict.forms.newsletterPlaceholder}
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

      <div
        className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor="newsletter-company">Company</label>
        <input
          id="newsletter-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="h-fit cursor-pointer bg-gold px-8 py-3 font-heading text-xs font-medium uppercase tracking-[0.2em] text-background transition-colors duration-300 ease-out hover:bg-champagne disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? dict.forms.sending : dict.forms.subscribe}
      </button>
    </form>
  );
}
