import { X } from "lucide-react";

import { Flacon } from "./Specimens";

/**
 * The two marketing surfaces the review brief calls out — the announcement
 * strip and the subscribe modal — in both grounds.
 *
 * Neither is currently ground-aware: both are hard obsidian, sitewide. Under
 * the proposed system the bar sits above a header that is sometimes ivory, and
 * the modal opens over pages that are mostly ivory, so both need a light
 * treatment as well as the dark one they already have.
 */

/* ── Announcement bar ───────────────────────────────────────── */

const MESSAGES = [
  "Complimentary shipping across Egypt",
  "The Gemstone Collection — now in boutique",
  "Discovery sets, six flacons",
];

export function AnnouncementSpec({
  ground = "dark",
  mode = "static",
}: {
  ground?: "dark" | "gold" | "sand";
  mode?: "static" | "marquee";
}) {
  const TONE = {
    dark: "bg-[var(--k-obsidian)] text-[rgba(247,245,240,0.78)] border-b border-[var(--k-line-gold)]",
    /*
     * Gold as a *ground* is only ever defensible on a 34px strip: it is the
     * one element small enough that a full-bleed accent still reads as a
     * detail. Anywhere larger and the 5% budget (§4) is gone in one element.
     */
    gold: "bg-[var(--k-gold)] text-[var(--k-obsidian)]",
    sand: "bg-[var(--k-sand)] text-[var(--k-on-light)] border-b border-[var(--k-line-light)]",
  } as const;

  return (
    <div
      className={`flex h-[34px] items-center overflow-hidden sm:h-[38px] ${TONE[ground]}`}
    >
      {mode === "marquee" ? (
        <div className="k-marquee flex w-max shrink-0 items-center">
          {[0, 1].map((run) => (
            <div key={run} className="flex items-center" aria-hidden={run === 1}>
              {MESSAGES.map((message) => (
                <span
                  key={message}
                  className="k-sans flex items-center whitespace-nowrap px-8 text-[10px] font-medium uppercase tracking-[0.22em]"
                >
                  {message}
                  <span className="ms-8 inline-block h-1 w-1 rounded-full bg-current opacity-40" />
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="k-sans w-full truncate px-5 text-center text-[10px] font-medium uppercase tracking-[0.22em]">
          {MESSAGES[0]}
        </p>
      )}
    </div>
  );
}

/* ── Subscribe / welcome-offer popup ────────────────────────── */

/**
 * The modal, as it would appear over the page — scrim included, since half of
 * what makes a modal read as premium is how much of the page it puts away.
 *
 * Two columns from `md` up, image over copy below it. The image column is the
 * reason the light treatment works at all: on a light modal the photograph is
 * the only thing carrying weight, so it takes the full half rather than being
 * cropped to a banner.
 */
export function OfferPopupSpec({
  ground = "dark",
}: {
  ground?: "dark" | "light";
}) {
  const dark = ground === "dark";

  return (
    <div className="relative flex min-h-[420px] items-center justify-center bg-[rgba(13,13,13,0.72)] p-5 backdrop-blur-[2px]">
      <div
        className={`relative grid w-full max-w-3xl grid-cols-1 overflow-hidden border shadow-[var(--k-shadow-3)] sm:grid-cols-2 ${
          /*
             The ground class, not just a background: `.k-dark` is what the
             field and button rules below key off, so the input inside a dark
             modal actually renders dark rather than punching a white box into
             the obsidian.
           */
          dark
            ? "k-dark border-[var(--k-line-gold)]"
            : "k-cream border-[var(--k-line-light)]"
        }`}
      >
        <button
          type="button"
          aria-label="Close"
          className={`absolute end-0 top-0 z-2 flex h-12 w-12 cursor-pointer items-center justify-center transition-colors duration-300 ${
            dark
              ? "text-[var(--k-on-dark-muted)] hover:text-[var(--k-gold)]"
              : "text-[var(--k-on-light-muted)] hover:text-[var(--k-on-light)]"
          }`}
        >
          <X size={18} strokeWidth={1.25} aria-hidden />
        </button>

        <div className="relative min-h-[180px] sm:min-h-[360px]">
          <Flacon tone={dark ? "dark" : "sand"} />
        </div>

        <div className="flex flex-col justify-center gap-5 p-7 sm:p-10">
          <div>
            <p
              className={`k-sans text-[10px] font-medium uppercase tracking-[0.3em] ${
                dark
                  ? "text-[var(--k-on-dark-accent)]"
                  : "text-[var(--k-on-light-accent)]"
              }`}
            >
              The House Letter
            </p>
            <h3
              className={`k-serif mt-3 text-2xl leading-tight tracking-[0.04em] ${
                dark ? "text-[var(--k-on-dark)]" : "text-[var(--k-on-light)]"
              }`}
            >
              Ten percent on your first flacon
            </h3>
            <div className="k-rule mt-4" />
          </div>

          <p
            className={`k-sans text-[13px] leading-relaxed ${
              dark
                ? "text-[var(--k-on-dark-muted)]"
                : "text-[var(--k-on-light-muted)]"
            }`}
          >
            New releases, private boutique evenings, and the occasional note on
            what is being distilled. No more than twice a month.
          </p>

          <div className="space-y-3">
            <label className="sr-only" htmlFor="k-offer-email">
              Email address
            </label>
            <input
              id="k-offer-email"
              type="email"
              placeholder="your@email.com"
              className="k-field"
            />
            {/*
              Inverse on dark, primary on light — the same button, resolved
              against its ground. An obsidian primary on an obsidian modal is
              an invisible call to action.
            */}
            <button
              type="button"
              className={`k-btn w-full ${dark ? "k-btn-inverse" : "k-btn-primary"}`}
            >
              Claim the offer
            </button>
          </div>

          <p
            className={`k-sans text-[10px] leading-relaxed ${
              dark
                ? "text-[rgba(184,179,170,0.65)]"
                : "text-[var(--k-on-light-muted)]"
            }`}
          >
            One email to confirm. Unsubscribe in a click.
          </p>
        </div>
      </div>
    </div>
  );
}
