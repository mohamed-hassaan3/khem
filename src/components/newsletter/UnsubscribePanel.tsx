"use client";

/**
 * The confirm-then-remove panel behind an unsubscribe link.
 *
 * Client-side because the removal must happen on a *press*, not on the render
 * of a page a link scanner fetched — see the header of
 * `src/actions/unsubscribe.ts` for why that distinction is the whole design.
 *
 * Four states, and the last three are all endings:
 *
 *  - **confirm** — the button, before anything has happened;
 *  - **done** — removed just now;
 *  - **already** — the token was good but they had left previously. Worded
 *    differently, but still a success: somebody who clicks twice must not be
 *    shown an error implying it did not work;
 *  - **invalid** — the token matched nothing. Says nothing about whether any
 *    address is on the list.
 *
 * A failure of the action itself falls back to the confirm state with a
 * message, because the one thing the reader can usefully do is press again.
 */

import { useState, useTransition } from "react";

import { confirmUnsubscribe } from "@/src/actions/unsubscribe";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";

type Phase = "confirm" | "done" | "already" | "invalid";

export default function UnsubscribePanel({
  token,
  copy,
}: {
  token: string;
  copy: Dictionary["unsubscribe"];
}) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [email, setEmail] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    setFailed(false);

    startTransition(async () => {
      try {
        const outcome = await confirmUnsubscribe(token);

        if (!outcome.found) {
          setPhase("invalid");
          return;
        }

        setEmail(outcome.email);
        setPhase(outcome.alreadyOff ? "already" : "done");
      } catch {
        // Nothing was removed, so the honest thing is to leave the button
        // there and say so.
        setFailed(true);
      }
    });
  }

  const heading =
    phase === "done"
      ? copy.doneHeading
      : phase === "already"
        ? copy.alreadyHeading
        : phase === "invalid"
          ? copy.invalidHeading
          : copy.confirmHeading;

  const body =
    phase === "done"
      ? copy.doneBody
      : phase === "already"
        ? copy.alreadyBody
        : phase === "invalid"
          ? copy.invalidBody
          : copy.confirmBody;

  return (
    <div className="mx-auto max-w-xl text-center">
      <p className="font-heading text-[10px] uppercase tracking-[0.3em] text-ground-accent/70">
        {copy.eyebrow}
      </p>

      <h1
        aria-live="polite"
        className="mt-6 font-heading text-2xl tracking-[0.08em] text-ground sm:text-3xl"
      >
        {heading}
      </h1>

      <p className="mt-6 text-[13px] leading-relaxed tracking-wide text-ground-muted">
        {body}
      </p>

      {/*
        The address is shown back only once it has actually been acted on, and
        only to somebody who arrived holding its token.
      */}
      {email && (phase === "done" || phase === "already") ? (
        <p className="mt-4 text-[13px] tracking-wide text-gold-soft">{email}</p>
      ) : null}

      {phase === "confirm" ? (
        <>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="mt-10 inline-flex items-center justify-center border border-ground-accent/40 px-10 py-4 font-heading text-[11px] uppercase tracking-[0.25em] text-ground-accent transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-gold hover:bg-gold/10 disabled:opacity-50 disabled:pointer-events-none"
          >
            {pending ? copy.working : copy.confirmButton}
          </button>

          {failed ? (
            <p role="alert" className="mt-5 text-[12px] tracking-wide text-danger">
              {copy.failedBody}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
