/**
 * KHEM's theme for Clerk's prebuilt components.
 *
 * Defined once and imported by `<ClerkProvider>`, `<SignIn>`, `<SignUp>`,
 * `<UserProfile>`, and `<UserButton>`. Clerk's default palette is a light card
 * with an indigo accent — dropped into a KHEM page it reads as a third-party
 * widget bolted onto the boutique, which is precisely the "generic SaaS
 * aesthetic" AGENTS.md §1.6 rules out.
 *
 * ## Light, not obsidian
 *
 * This object used to be written against the dark tokens — `#1a1a1a` card,
 * ivory type — from a time when the site was dark all the way up. Every surface
 * that mounts a Clerk component is now light: `<AuthShell>` is `ground-ivory`,
 * `/account` is `ground-ivory`, and the `<UserButton>` popover opens over an
 * ivory header. A near-black card in the middle of a page of paper is the
 * mismatch that made the sign-in screen read as generic; it is not that Clerk
 * was under-themed, it is that it was themed for a different site.
 *
 * So the same variables are re-pointed at the light ground. Nothing about the
 * flow, the redirects, or the metadata changes — this file is presentation.
 *
 * The values are the §3.1 design tokens. They are written as literals rather
 * than as `var(--color-gold)` because Clerk renders parts of its UI (the modal
 * backdrop, the shimmer) outside the element these variables cascade through,
 * where a custom property defined on `:root` in `globals.css` is available but
 * a *theme* token compiled by Tailwind v4 is not guaranteed to be. Literals
 * here cannot drift silently: the token block in `globals.css` is the source,
 * and this file names it in the comment beside each value.
 *
 * Flow decisions (`useSignIn`/`useSignUp` hand-rolled forms) are deliberately
 * not taken. Owning the flow means owning password reset, MFA, OAuth
 * callbacks, bot protection, and every error string in two languages. It is
 * also why the password policy is not expressible here at all — it lives in the
 * Clerk Dashboard; see `src/docs/clerk-password-policy.md`.
 */

/*
 * Deliberately not annotated.
 *
 * Clerk v7 types the `appearance` prop as `Appearance<Theme>` through an
 * augmentable registry, but that type is only declared inside a hashed
 * internal chunk of `@clerk/react` — there is no stable path to import it
 * from, and `@clerk/types` is the Core 2 package, not a dependency here.
 *
 * So the object stays inferred and is checked structurally where it is used,
 * which is the strongest guarantee available without importing a private
 * module path that a patch release could rename. The one place inference is
 * too loose — a literal union — is pinned with `as const` below.
 */

/* §3.1 tokens, mirrored from `globals.css`. */
const IVORY = "#f7f5f0";
const STONE = "#efebe4";
const INK = "#242321";
const INK_MUTED = "#625f58";
const BORDER_LIGHT = "#d8d3ca";
/* The gold that survives as text on a light ground — ~4.9:1 on ivory. */
const GOLD_DEEP = "#8a6a3f";
const DANGER = "#c0392b";
const SUCCESS = "#4caf50";
const WARNING = "#e8a317";

export const khemClerkAppearance = {
  variables: {
    colorPrimary: GOLD_DEEP,
    colorPrimaryForeground: IVORY,

    colorBackground: IVORY,
    colorForeground: INK,
    colorMutedForeground: INK_MUTED,
    colorMuted: STONE,

    /*
     * The single most important value in this file.
     *
     * Clerk *generates* a shade ramp from `colorNeutral` and uses it for
     * borders, hover backgrounds, and — critically — the text of dropdown
     * options and social buttons. It is not a text colour itself: setting
     * `colorForeground` alone does not reach those elements.
     *
     * It was ivory here, which was correct while the card was obsidian and
     * wrong the moment the card became paper — light generated shades on a
     * light card is the "Continue with Google" label disappearing. Ink is the
     * same decision taken for the light ground.
     */
    colorNeutral: INK,

    /* A wash of ink rather than of white: the card it sits on is already ivory. */
    colorInput: "rgba(36, 35, 33, 0.03)",
    colorInputForeground: INK,

    colorBorder: BORDER_LIGHT,
    colorRing: GOLD_DEEP,
    colorShimmer: "rgba(138, 106, 63, 0.16)",
    colorShadow: "rgba(36, 35, 33, 0.12)",
    /* Ink, not black. A pure-black scrim over a paper page reads as a different site. */
    colorModalBackdrop: "rgba(36, 35, 33, 0.55)",

    colorDanger: DANGER,
    colorSuccess: SUCCESS,
    colorWarning: WARNING,

    /*
     * The font stacks resolve through the variables the locale layout puts on
     * `<body>`, so Arabic gets its own faces without a second appearance
     * object — `--font-heading` and `--font-body` are already locale-aware
     * (see `src/lib/fonts.ts`).
     */
    fontFamily: "var(--font-body)",
    fontFamilyButtons: "var(--font-heading)",

    /* §3.2: sharp or minimal radius. Clerk's default is a rounded card. */
    borderRadius: "2px",
  },

  elements: {
    /*
     * The card sits inside `<AuthShell>`, which already draws the framed
     * surface — so Clerk's own card carries only the house hairline rather
     * than painting a second raised box inside the first.
     */
    cardBox: {
      boxShadow: "none",
      border: `1px solid ${BORDER_LIGHT}`,
    },
    card: {
      backgroundColor: IVORY,
      boxShadow: "none",
    },

    headerTitle: {
      fontFamily: "var(--font-heading)",
      letterSpacing: "0.04em",
    },

    /* §3.2: uppercase, wide tracking, no bounce. */
    formButtonPrimary: {
      textTransform: "uppercase",
      letterSpacing: "0.2em",
      fontSize: "11px",
      transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      /*
       * Hovers to ink, not to champagne. Champagne was the lift a gold button
       * takes on obsidian; on paper it is a pale button going paler, and the
       * ivory label on it disappears. Ink is the house's other structural
       * colour and the same move the site's own buttons make on light.
       */
      "&:hover": { backgroundColor: INK },
    },

    footerActionLink: {
      color: GOLD_DEEP,
      "&:hover": { color: INK },
    },
  },

  /*
   * `options` is the v7 name for what Core 2 called `layout`. Social buttons
   * render as a block above the form; the "secured by Clerk" badge stays —
   * removing it is a paid-plan feature, and faking its absence with CSS is the
   * kind of thing that breaks on a Clerk release.
   */
  options: {
    // `as const` because the prop's type is a literal union and an inferred
    // object widens this to `string`.
    socialButtonsVariant: "blockButton" as const,
    shimmer: true,
  },
};
