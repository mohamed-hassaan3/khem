"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";

import { sendContactEnquiry } from "@/src/actions/contact";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";

/**
 * Contact enquiry form.
 *
 * The enquiry is delivered by `actions/contact.ts` to the house mailbox via
 * Resend, with `Reply-To` set to the visitor.
 *
 * The client-side validation below is a UX affordance — first-invalid-field
 * focus, inline errors — and never a security boundary. `schemas/contact.ts`
 * re-validates every field inside the action, which also throttles and treats
 * the message body as untrusted when it builds the email.
 */

/** Pragmatic shape check, matching `NewsletterForm`. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Mirrors `MESSAGE_MIN_LENGTH` in the schema, so the two agree on "too short". */
const MESSAGE_MIN_LENGTH = 10;

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
  const dict = useDictionary();
  /** Sent with the enquiry so the acknowledgement arrives in this language. */
  const locale = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(subjects[0] ?? "");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [isSent, setIsSent] = useState(false);
  /** Delivery/throttle failure, as a dictionary string. Field errors go above. */
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /**
   * Honeypot. Hidden from sight and from the tab order, so only a bot walking
   * the DOM fills it. The server drops any submission where it is non-empty.
   */
  const [company, setCompany] = useState("");

  /**
   * Error codes the action returns, resolved against the dictionary here — the
   * server sends codes precisely so no English string can reach an Arabic page.
   */
  const fieldMessages: Record<string, string> = {
    nameRequired: dict.contactForm.nameRequired,
    nameTooLong: dict.contactForm.nameTooLong,
    emailInvalid: dict.contactForm.emailInvalid,
    subjectInvalid: dict.contactForm.subjectInvalid,
    messageRequired: dict.contactForm.messageRequired,
    messageTooShort: dict.contactForm.messageTooShort,
    messageTooLong: dict.contactForm.messageTooLong,
  };

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

    if (isPending) return;
    setFormError(null);

    const nextErrors: Partial<Record<Field, string>> = {};

    if (name.trim().length === 0) {
      nextErrors.name = dict.contactForm.nameRequired;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = dict.contactForm.emailInvalid;
    }
    if (message.trim().length === 0) {
      nextErrors.message = dict.contactForm.messageRequired;
    } else if (message.trim().length < MESSAGE_MIN_LENGTH) {
      nextErrors.message = dict.contactForm.messageTooShort;
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

    startTransition(async () => {
      const result = await sendContactEnquiry({
        name: name.trim(),
        email: email.trim(),
        subject,
        message: message.trim(),
        company,
        locale,
      });

      if (result.ok) {
        setIsSent(true);
        return;
      }

      if (result.error === "validation" && result.fieldErrors) {
        // The server disagreed with the client check — a stricter rule, or a
        // subject that is no longer on the list. Surface it on the field.
        const serverErrors: Partial<Record<Field, string>> = {};
        for (const [field, code] of Object.entries(result.fieldErrors)) {
          const resolved = fieldMessages[code] ?? dict.forms.errorMessage;
          if (field === "name" || field === "email" || field === "message") {
            serverErrors[field] = resolved;
          } else {
            // `subject` has no inline slot; it belongs to the form-level region.
            setFormError(resolved);
          }
        }
        setErrors(serverErrors);
        return;
      }

      setFormError(
        result.error === "rateLimited"
          ? dict.forms.rateLimited
          : dict.forms.deliveryFailed,
      );
    });
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
          {dict.contactForm.successHeading}
        </p>
        <p className="text-[13px] leading-loose text-ivory/45">
          {dict.contactForm.successBody}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="relative flex flex-col gap-5"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className={LABEL_CLASS}>
            {dict.contactForm.yourName}
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
            {dict.contactForm.emailAddress}
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
          {dict.forms.subject}
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
          {dict.forms.message}
        </label>
        <textarea
          id="contact-message"
          name="message"
          ref={messageRef}
          rows={6}
          // Matches MESSAGE_MAX_LENGTH in `schemas/contact.ts`. A convenience,
          // not the limit — the server enforces the same cap independently.
          maxLength={4000}
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

      {/*
        Honeypot: off-screen rather than `display:none`, since some bots skip
        hidden fields. `tabIndex={-1}` and `aria-hidden` keep it away from
        keyboard and screen-reader users, who never encounter it.
      */}
      <div
        className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
      </div>

      {formError ? (
        <p role="alert" className="text-[12px] leading-relaxed text-danger">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="btn-luxury btn-luxury-fill min-w-50 justify-center self-start disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? dict.forms.sending : dict.forms.send}
      </button>
    </form>
  );
}
