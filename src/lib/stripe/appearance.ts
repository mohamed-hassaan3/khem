/**
 * The Payment Element, dressed as KHEM.
 *
 * Stripe renders its fields inside a cross-origin iframe, so the stylesheet
 * cannot reach them and neither can a Tailwind class. The Appearance API is the
 * only channel, and it takes literal values — no CSS variables, no
 * `color-mix()`. So the tokens are restated here exactly as they are in
 * `@theme`, the same compromise `src/lib/email/layout.ts` documents for email.
 *
 * **Keep in step with the stylesheet.** A gold that is one shade off inside the
 * card field and correct everywhere around it is more noticeable than no
 * theming at all.
 *
 * The `rules` map is where the house style actually lands. Stripe's default
 * input is a filled box with a rounded border; §3.2 says a thin bottom rule on
 * a transparent fill, with an uppercase gold label above it. That is what these
 * rules build, so a card number sits in the same kind of field as the delivery
 * address directly above it.
 */

import type { Appearance } from "@stripe/stripe-js";

const GOLD = "#c8a96a";
const CHAMPAGNE = "#e6d6a8";
const IVORY = "#f7f4ec";
const BACKGROUND = "#0d0d0d";
const SURFACE = "#1a1a1a";
const DANGER = "#c0392b";
const MUTED = "#8f8f92";
const BORDER = "rgba(255, 255, 255, 0.10)";

const SANS =
  "var(--font-body), 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const stripeAppearance: Appearance = {
  // `night` rather than `stripe`: it sets the defaults for everything the
  // `rules` below do not name, and starting from a light base would mean
  // overriding every one of them or leaving white gaps where Stripe adds a
  // component we have not styled.
  theme: "night",

  variables: {
    colorPrimary: GOLD,
    colorBackground: SURFACE,
    colorText: IVORY,
    colorTextSecondary: MUTED,
    colorTextPlaceholder: "rgba(247, 244, 236, 0.28)",
    colorDanger: DANGER,
    colorIcon: GOLD,
    fontFamily: SANS,
    fontSizeBase: "15px",
    spacingUnit: "5px",
    // 6px is `--radius-sm`. The house uses sharp corners on buttons and near
    // sharp on fields; anything larger reads as a generic SaaS form.
    borderRadius: "6px",
  },

  rules: {
    ".Input": {
      backgroundColor: "transparent",
      border: "none",
      borderBottom: `1px solid ${BORDER}`,
      borderRadius: "0",
      boxShadow: "none",
      padding: "12px 2px",
      color: IVORY,
      transition: "border-color 300ms ease-out, box-shadow 300ms ease-out",
    },
    ".Input:hover": {
      borderBottom: `1px solid rgba(200, 169, 106, 0.45)`,
    },
    ".Input:focus": {
      borderBottom: `1px solid ${GOLD}`,
      // The glow §3.2 asks for, standing in for the webkit focus ring that is
      // suppressed everywhere else on the site.
      boxShadow: "0 1px 0 0 rgba(200, 169, 106, 0.35)",
      outline: "none",
    },
    ".Input--invalid": {
      borderBottom: `1px solid ${DANGER}`,
      boxShadow: "none",
      color: IVORY,
    },
    ".Label": {
      color: GOLD,
      fontSize: "10px",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      marginBottom: "6px",
    },
    ".Error": {
      color: DANGER,
      fontSize: "11px",
      letterSpacing: "0.03em",
      marginTop: "8px",
    },
    // The saved-method and wallet tiles, when Stripe offers them.
    ".Tab": {
      backgroundColor: BACKGROUND,
      border: `1px solid ${BORDER}`,
      borderRadius: "0",
      boxShadow: "none",
      color: MUTED,
      transition: "border-color 400ms ease-out, color 400ms ease-out",
    },
    ".Tab:hover": {
      color: CHAMPAGNE,
      border: `1px solid rgba(200, 169, 106, 0.35)`,
    },
    ".Tab--selected": {
      backgroundColor: BACKGROUND,
      border: `1px solid ${GOLD}`,
      color: GOLD,
      boxShadow: "0 0 24px rgba(200, 169, 106, 0.14)",
    },
    ".TabLabel": {
      fontSize: "11px",
      letterSpacing: "0.14em",
      textTransform: "uppercase",
    },
    ".TabIcon--selected": {
      fill: GOLD,
    },
    ".Block": {
      backgroundColor: BACKGROUND,
      border: `1px solid ${BORDER}`,
      borderRadius: "0",
      boxShadow: "none",
    },
  },
};
