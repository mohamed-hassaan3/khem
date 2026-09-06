"use client";

import { useState, useTransition, type FormEvent } from "react";

import { subscribeToNewsletter } from "@/src/actions/newsletter";

/**
 * ⚠️ TEMPORARY — the Inner Circle signup, as it appears on the cover.
 *
 * ## What this reuses, and what it does not duplicate
 *
 * It calls `subscribeToNewsletter()` — the existing action, unchanged — and
 * therefore inherits the existing rate limit, honeypot, server-side validation,
 * subscriber row and welcome letter. There is **no** second subscriber table,
 * endpoint, audience, template, discount or storage key anywhere in this
 * feature, which is what §7 of the brief is about.
 *
 * What is written fresh is presentation, and only because it has to be: the real
 * `<NewsletterForm>` reads its copy from `useDictionary()`, and the cover is a
 * sibling root layout with no `I18nProvider` above it (see
 * `app/prelaunch/layout.tsx`). Rather than wrap the cover in a provider — which
 * would serialise the entire dictionary into the page for two strings — the
 * words are read from the English dictionary on the server and handed down as
 * {@link PrelaunchSubscribeLabels}. So the cover cannot drift from the site's
 * own wording, and it pays nothing for the privilege.
 *
 * The client-side shape check, the honeypot and the error mapping mirror
 * `NewsletterForm` deliberately: they are the client half of the action's
 * contract, and a form that skipped them would send it input it does not expect.
 */

/** Copy this form needs, read from the English dictionary by the server. */
export interface PrelaunchSubscribeLabels {
  placeholder: string;
  submit: string;
  sending: string;
  invalidEmail: string;
  rateLimited: string;
  deliveryFailed: string;
  successHeading: string;
  successBody: string;
}

/** Pragmatic shape check; the authoritative validation happens server-side. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function PrelaunchSubscribe({
  labels,
}: {
  labels: PrelaunchSubscribeLabels;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isPending, startTransition] = useTransition();
  /** Honeypot — off-screen rather than hidden, as `ContactForm` explains. */
  const [company, setCompany] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) return;

    const trimmed = email.trim();

    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(labels.invalidEmail);
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await subscribeToNewsletter({
        email: trimmed,
        company,
        // The cover is English-only, so the welcome letter is too. If the cover
        // is ever translated this must become the visitor's locale, or an Arabic
        // subscriber will be written an English welcome.
        locale: "en",
      });

      if (result.ok) {
        setIsSubscribed(true);
        return;
      }

      setError(
        result.error === "rateLimited"
          ? labels.rateLimited
          : result.error === "validation"
            ? labels.invalidEmail
            : labels.deliveryFailed,
      );
    });
  }

  if (isSubscribed) {
    return (
      <div
        role="status"
        className="border border-gold/45 bg-ivory/45 px-6 py-5 text-center"
      >
        <p className="font-heading text-[11px] uppercase tracking-[0.24em] text-gold-deep">
          {labels.successHeading}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          {labels.successBody}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="relative mx-auto flex w-full max-w-md flex-col gap-3 sm:flex-row"
    >
      <div className="flex-1 text-start">
        <label htmlFor="prelaunch-email" className="sr-only">
          {labels.placeholder}
        </label>
        <input
          id="prelaunch-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(null);
          }}
          placeholder={labels.placeholder}
          aria-invalid={error !== null}
          aria-describedby={error ? "prelaunch-email-error" : undefined}
          className="field khem-cover-field"
        />
        {error ? (
          <p
            id="prelaunch-email-error"
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
        <label htmlFor="prelaunch-company">Company</label>
        <input
          id="prelaunch-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
      </div>

      {/*
       * `leading-6` and a 1px border are what make this the same height as the
       * field beside it — the derivation is documented in `NewsletterForm.tsx`
       * and is copied rather than re-guessed, so the two halves stay aligned if
       * `.field` ever changes.
       *
       * Outlined rather than the site's solid ink primary. On a storefront page
       * a filled button is the action the page wants taken; here it was simply
       * the heaviest object on a screen built out of light, louder than the mark
       * itself. It fills on hover, so the affordance is not lost — only its
       * volume at rest.
       */}
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="khem-cover-focus h-fit cursor-pointer border border-ink/35 bg-transparent px-7 py-3 font-heading text-[11px] font-medium uppercase leading-6 tracking-[0.2em] text-ink transition-colors duration-300 ease-out hover:border-ink hover:bg-ink hover:text-ivory disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? labels.sending : labels.submit}
      </button>
    </form>
  );
}
