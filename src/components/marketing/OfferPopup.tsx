"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";

import { subscribeForOffer } from "@/src/actions/marketing";
import { useIsHydrated } from "@/src/hooks/use-is-hydrated";
import {
  OFFER_STORAGE_KEY,
  isStoredOffer,
  mayShowOffer,
  toOfferRecord,
  type OfferOutcome,
} from "@/src/lib/marketing";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { readStored, writeStored } from "@/src/lib/storage";
import { useConsent } from "@/src/providers/consent-provider";
import { useCurrency } from "@/src/providers/currency-provider";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";
import type { MarketingSettings, WelcomeOfferSummary } from "@/src/types/marketing";

/**
 * The subscribe-and-earn offer, as a modal.
 *
 * ## When it appears, and when it does not
 *
 * Four gates, all of which must open:
 *
 *  1. the house has it switched on (`offerPopupEnabled`);
 *  2. the visitor has not subscribed, and has not dismissed it inside the snooze
 *     window (`src/lib/marketing.ts`);
 *  3. the cookie banner has been answered — two modals arriving together is
 *     precisely the aggression the brief rules out;
 *  4. either the delay has elapsed **or** the visitor has read far enough down a
 *     page to count as engaged.
 *
 * (4) is why this is not simply a `setTimeout`. A visitor who has scrolled a
 * quarter of the way through a collection is interested now; one who opened the
 * tab and left is not, and the timer alone cannot tell them apart. Whichever
 * signal arrives first opens it, and neither is armed until (1)–(3) hold.
 *
 * ## What crosses to the browser, and what does not
 *
 * The **percentage** does — it is printed on the panel. The **code** does not,
 * until somebody has actually subscribed and the server has written a grant in
 * their name. Nothing here computes an entitlement: `subscribeForOffer()` puts
 * the address on the list and `claim_subscriber_offer()` issues the grant, both
 * server-side, and this component renders whichever code comes back.
 *
 * ## Stacking
 *
 * `z-1200` — above every other overlay on the site, including the search panel
 * (`z-1100`) and the cart drawer (`z-1050`). It is the only surface that takes
 * the whole viewport and traps focus, so anything rendering over it would be
 * unreachable rather than merely on top.
 *
 * ## Focus
 *
 * A real dialog: `role="dialog"` and `aria-modal`, focus moved to the panel on
 * open and returned to whatever had it on close, Escape closes, and Tab is
 * trapped inside. The body's scroll is locked while it is open, because a modal
 * that scrolls the page behind it is a modal somebody will close by accident.
 */

const EASE_LUXURY: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Pragmatic shape check; the authoritative validation is the server's. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Elements that can hold focus inside the panel, for the trap. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Phase = "form" | "done";

export default function OfferPopup({
  settings,
  offer,
}: {
  settings: MarketingSettings;
  /** The live welcome offer, or null when the house is running none. */
  offer: WelcomeOfferSummary | null;
}) {
  const dict = useDictionary();
  const locale = useLocale();
  const { formatPrice } = useCurrency();
  const { hasDecided, isHydrated: consentHydrated } = useConsent();
  const isHydrated = useIsHydrated();
  const prefersReducedMotion = useReducedMotion();

  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  /** Guards against the timer and the scroll listener both opening it. */
  const openedRef = useRef(false);

  /** Write the outcome first, then close: a dismissal that is not recorded is
   *  a dismissal that will be ignored on the next page. */
  const remember = useCallback((outcome: OfferOutcome) => {
    writeStored(OFFER_STORAGE_KEY, toOfferRecord(outcome));
  }, []);

  const close = useCallback(() => {
    // Only a dismissal is recorded here; a subscription was already recorded at
    // the moment it succeeded, and re-stamping it would move its timestamp.
    if (phase === "form") remember("dismissed");
    setIsOpen(false);
  }, [phase, remember]);

  // ── The four gates ────────────────────────────────────────
  useEffect(() => {
    if (!settings.offerPopupEnabled) return;
    if (!isHydrated || !consentHydrated) return;
    if (!hasDecided) return;
    if (openedRef.current) return;

    const stored = readStored(OFFER_STORAGE_KEY, isStoredOffer, null);
    if (!mayShowOffer(stored, settings.offerPopupSnoozeDays)) return;

    function open() {
      if (openedRef.current) return;
      openedRef.current = true;
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setIsOpen(true);
    }

    const timer = window.setTimeout(open, settings.offerPopupDelayMs);

    /*
     * The engagement signal. Passive, and it removes itself the moment it
     * fires: a scroll listener that outlives its purpose is a scroll listener
     * running on every frame of every page for nothing.
     */
    const threshold = settings.offerPopupScrollPercent;

    function onScroll() {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;

      const progress = (window.scrollY / scrollable) * 100;
      if (progress >= threshold) open();
    }

    if (threshold > 0) {
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [
    settings.offerPopupEnabled,
    settings.offerPopupDelayMs,
    settings.offerPopupScrollPercent,
    settings.offerPopupSnoozeDays,
    isHydrated,
    consentHydrated,
    hasDecided,
  ]);

  // ── Escape, the focus trap, and the scroll lock ───────────
  useEffect(() => {
    if (!isOpen) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      returnFocusRef.current?.focus();
    };
  }, [isOpen, close]);

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
      const result = await subscribeForOffer({
        email: trimmed,
        company,
        locale,
      });

      if (result.ok) {
        setCode(result.code);
        setAlreadySubscribed(result.alreadySubscribed);
        setPhase("done");
        remember("subscribed");
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

  /*
   * The promise, in the shape the live campaign actually takes. Never a
   * hard-coded percentage: `offer` is the `discounts."isWelcome"` row, so a
   * house running a fixed-amount welcome says so, and one running none invites
   * people to the list without promising anything.
   */
  const offerLine =
    offer === null
      ? dict.offerPopup.plainOffer
      : offer.kind === "PERCENTAGE"
        ? interpolate(dict.offerPopup.percentOffer, {
            percent: String(offer.value),
          })
        : interpolate(dict.offerPopup.amountOffer, {
            amount: formatPrice(offer.value),
          });

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          /*
            Centred at every width, with a margin the scrim shows through on all
            four sides. It used to dock to the bottom edge-to-edge on a phone —
            a bottom sheet, which reads as part of the page rather than as
            something over it, and which a thumb dismisses by accident. The
            padding here *is* the margin: the panel is `w-full` inside it.
          */
          className="fixed inset-0 z-1200 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-md sm:p-6"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: EASE_LUXURY }}
          onClick={(event) => {
            // The scrim closes; the panel does not.
            if (event.target === event.currentTarget) close();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="offer-popup-heading"
            tabIndex={-1}
            initial={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.6, ease: EASE_LUXURY }}
            /*
              `100dvh` minus the scrim's own padding, so the panel is never
              taller than the space it was given — `dvh` rather than `vh`
              because a mobile browser's toolbars change the viewport as it
              scrolls, and `vh` would leave the last row under the chrome.
            */
            /*
              `ground-ivory` for the same reason as the cart and search panels:
              a modal is its own surface and must not pick up the foreground
              variables of the page it is covering.

              Ivory rather than obsidian. This modal is the most interruptive
              surface on the site — it arrives unbidden over whatever the
              visitor was reading — so it is the last place that should also
              change the lights. On ivory with a charcoal action it reads as an
              invitation from the house; in obsidian it read as a takeover.
              The photograph on the other half of the grid is what carries the
              drama, which is the trade §17 asks for everywhere.
            */
            className="ground-ivory relative grid max-h-[calc(100dvh-2rem)] w-full max-w-4xl grid-cols-1 overflow-y-auto border border-ground-accent/25 shadow-3 focus:outline-none sm:max-h-[calc(100dvh-3rem)] md:grid-cols-2"
          >
            <button
              type="button"
              onClick={close}
              aria-label={dict.offerPopup.close}
              className="absolute end-0 top-0 z-2 flex h-12 w-12 cursor-pointer items-center justify-center text-ground-muted transition-colors duration-300 hover:text-ground-accent focus-visible:text-ground-accent focus-visible:outline-none"
            >
              <X size={18} strokeWidth={1.25} />
            </button>

            {/*
              The photograph.
              
              A 4:5 band on a phone rather than the desktop half — squeezing a
              tall editorial crop into a phone-width column leaves a letterbox
              with no room for the form under it, which is the "do not simply
              squeeze the desktop layout" note in the brief. On md and up it is
              a full-height column beside the copy.
            */}
            {/*
              A band on a phone, a column beside the copy from `md` up.
              
              Fixed heights rather than an aspect ratio below `md`: a 4:5 crop in
              a 343px-wide panel is 429px tall on its own, which pushes the email
              field off a 667px screen and leaves the visitor scrolling a modal
              to find the thing it is asking them to do.
            */}
            <div className="relative h-40 w-full shrink-0 overflow-hidden bg-sand sm:h-56 md:h-full md:min-h-[30rem] md:shrink">
              {settings.offerPopupImageUrl ? (
                <Image
                  src={settings.offerPopupImageUrl}
                  alt={settings.offerPopupImageAlt}
                  fill
                  sizes="(min-width: 768px) 32rem, 100vw"
                  className="object-cover brightness-75"
                  priority={false}
                />
              ) : null}
              {/* A gradient toward the copy, so the seam between the halves is
                  light rather than a hard edge. */}
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-b from-transparent to-background/70 md:bg-gradient-to-e md:from-transparent md:to-background/60"
              />
            </div>

            <div className="flex flex-col justify-center gap-5 p-7 text-start sm:p-10 md:p-12">
              {phase === "form" ? (
                <>
                  <p className="font-heading text-[10px] uppercase tracking-[0.3em] text-ground-accent/70">
                    {settings.offerPopupEyebrow ?? dict.offerPopup.eyebrow}
                  </p>

                  <h2
                    id="offer-popup-heading"
                    dir="auto"
                    className="font-heading text-2xl leading-tight font-normal text-ground sm:text-3xl"
                  >
                    {settings.offerPopupHeading}
                  </h2>

                  <div className="gold-line" />

                  <p dir="auto" className="text-[13px] leading-loose text-ground-muted">
                    {settings.offerPopupBody ?? offerLine}
                  </p>

                  {/* When the house wrote its own body copy the offer still has
                      to be stated, or the panel promises nothing. */}
                  {settings.offerPopupBody ? (
                    <p className="font-heading text-sm tracking-[0.12em] text-gold-soft">
                      {offerLine}
                    </p>
                  ) : null}

                  <form onSubmit={handleSubmit} noValidate className="relative space-y-3">
                    <label htmlFor="offer-email" className="sr-only">
                      {dict.offerPopup.emailLabel}
                    </label>
                    <input
                      id="offer-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (error) setError(null);
                      }}
                      placeholder={dict.offerPopup.emailPlaceholder}
                      aria-invalid={error !== null}
                      aria-describedby={error ? "offer-email-error" : undefined}
                      className="field"
                    />

                    {/* Honeypot — off-screen rather than hidden, matching
                        `ContactForm.tsx`. */}
                    <div
                      className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
                      aria-hidden="true"
                    >
                      <label htmlFor="offer-company">Company</label>
                      <input
                        id="offer-company"
                        name="company"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={company}
                        onChange={(event) => setCompany(event.target.value)}
                      />
                    </div>

                    {error ? (
                      <p
                        id="offer-email-error"
                        role="alert"
                        className="text-[11px] tracking-wide text-danger"
                      >
                        {error}
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      disabled={isPending}
                      aria-busy={isPending}
                      className="w-full cursor-pointer bg-gold px-8 py-3.5 font-heading text-xs font-medium uppercase tracking-[0.2em] text-background transition-colors duration-300 ease-out hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPending
                        ? dict.offerPopup.submitting
                        : dict.offerPopup.submit}
                    </button>
                  </form>

                  <p className="text-[10px] tracking-[0.08em] text-ground-muted/70">
                    {dict.offerPopup.disclaimer}
                  </p>
                </>
              ) : (
                <div role="status" className="space-y-5">
                  <h2
                    id="offer-popup-heading"
                    className="font-heading text-2xl leading-tight font-normal text-ground-accent sm:text-3xl"
                  >
                    {dict.offerPopup.successHeading}
                  </h2>

                  <div className="gold-line" />

                  <p dir="auto" className="text-[13px] leading-loose text-ground-muted">
                    {alreadySubscribed
                      ? dict.offerPopup.alreadyBody
                      : dict.offerPopup.successBody}
                  </p>

                  {code ? (
                    /*
                      The code is shown as well as sent. Somebody who has just
                      typed their address is about to shop, not about to open
                      their inbox — and it is a real grant by the time it
                      reaches this line, written in their name by
                      `claim_subscriber_offer()`.
                    */
                    <p className="border border-ground-accent/30 bg-gold/5 px-4 py-3 text-[12px] tracking-[0.08em] text-gold-soft">
                      {interpolate(dict.offerPopup.successCode, { code })}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-full cursor-pointer border border-ground-accent/40 px-8 py-3.5 font-heading text-xs uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:bg-gold/10"
                  >
                    {dict.offerPopup.close}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
