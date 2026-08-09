"use client";

import { useRef, useState, type FormEvent } from "react";

/**
 * Contact enquiry form.
 *
 * IMPORTANT: nothing typed here is transmitted, logged, or stored. Validation
 * runs client-side only, which is a UX affordance — never a security boundary.
 *
 * TODO: add `schemas/contact.ts` (Zod) + `actions/contact.ts` (Server Action)
 * and hand off to Resend. The server must re-validate every field, rate-limit
 * the action, and treat the message body as untrusted in the email template.
 * Until that lands the success copy's "within 24 hours" promise is not backed
 * by any delivery.
 */

/** Pragmatic shape check, matching `NewsletterForm`. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Field = "name" | "email" | "message";

const FIELD_CLASS =
  "w-full border border-border bg-ivory/3 px-5 py-4 text-[13px] tracking-wide text-ivory transition-colors duration-300 placeholder:text-ivory/25 focus:border-gold/40 focus:outline-none";

const LABEL_CLASS =
  "mb-2.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35";

const ERROR_CLASS = "mt-2 text-[11px] tracking-wide text-danger";

export interface ContactFormProps {
  /** Subject options, queried server-side. */
  subjects: string[];
}

export default function ContactForm({ subjects }: ContactFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(subjects[0] ?? "");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [isSent, setIsSent] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  function clearError(field: Field) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Partial<Record<Field, string>> = {};

    if (name.trim().length === 0) {
      nextErrors.name = "Please enter your name.";
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }
    if (message.trim().length === 0) {
      nextErrors.message = "Please enter a message.";
    }

    setErrors(nextErrors);

    // Move focus to the first field that failed, so the error is not merely
    // visual.
    const firstInvalid: Field | undefined = (
      ["name", "email", "message"] as const
    ).find((field) => nextErrors[field]);

    if (firstInvalid) {
      const target = {
        name: nameRef,
        email: emailRef,
        message: messageRef,
      }[firstInvalid];
      target.current?.focus();
      return;
    }

    // TODO (see file header): hand `{ name, email, subject, message }` to the
    // Server Action. Nothing leaves the browser today.
    setIsSent(true);
  }

  if (isSent) {
    return (
      <div
        role="status"
        className="border border-gold/20 bg-gold/5 p-10 text-center md:p-12"
      >
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-gold text-gold">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="mb-2.5 font-heading text-base tracking-widest text-gold">
          Message Received
        </p>
        <p className="text-[13px] leading-loose text-ivory/45">
          We will respond within 24 hours. Thank you for your enquiry.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className={LABEL_CLASS}>
            Your Name
          </label>
          <input
            id="contact-name"
            name="name"
            ref={nameRef}
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearError("name");
            }}
            aria-invalid={errors.name !== undefined}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            className={FIELD_CLASS}
          />
          {errors.name ? (
            <p id="contact-name-error" className={ERROR_CLASS}>
              {errors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="contact-email" className={LABEL_CLASS}>
            Email Address
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            ref={emailRef}
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearError("email");
            }}
            aria-invalid={errors.email !== undefined}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            className={FIELD_CLASS}
          />
          {errors.email ? (
            <p id="contact-email-error" className={ERROR_CLASS}>
              {errors.email}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="contact-subject" className={LABEL_CLASS}>
          Subject
        </label>
        <select
          id="contact-subject"
          name="subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className={`${FIELD_CLASS} cursor-pointer appearance-none`}
        >
          {subjects.map((option) => (
            <option key={option} value={option} className="bg-surface">
              {option}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="contact-message" className={LABEL_CLASS}>
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          ref={messageRef}
          rows={6}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            clearError("message");
          }}
          aria-invalid={errors.message !== undefined}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          className={`${FIELD_CLASS} resize-none`}
        />
        {errors.message ? (
          <p id="contact-message-error" className={ERROR_CLASS}>
            {errors.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        className="btn-luxury btn-luxury-fill min-w-50 justify-center self-start"
      >
        Send Message
      </button>
    </form>
  );
}
