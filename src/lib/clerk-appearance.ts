/**
 * KHEM's theme for Clerk's prebuilt components.
 *
 * Defined once and imported by `<ClerkProvider>`, `<SignIn>`, `<SignUp>`,
 * `<UserProfile>`, and `<UserButton>`. Clerk's default palette is a light card
 * with an indigo accent — dropped into an obsidian page it reads as a
 * third-party widget bolted onto the boutique, which is precisely the "generic
 * SaaS aesthetic" AGENTS.md §1.6 rules out.
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
 * callbacks, bot protection, and every error string in two languages.
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
const BACKGROUND = "#0d0d0d";
const SURFACE = "#1a1a1a";
const CARD = "#242424";
const GOLD = "#c8a96a";
const CHAMPAGNE = "#e6d6a8";
const IVORY = "#f7f4ec";
const DANGER = "#c0392b";
const SUCCESS = "#4caf50";
const WARNING = "#e8a317";

export const khemClerkAppearance = {
  variables: {
    colorPrimary: GOLD,
    colorPrimaryForeground: BACKGROUND,

    colorBackground: SURFACE,
    colorForeground: IVORY,
    colorMutedForeground: "rgba(247, 244, 236, 0.45)",
    colorMuted: CARD,

    /*
     * The single most important value in this file for a dark theme.
     *
     * Clerk *generates* a shade ramp from `colorNeutral` and uses it for
     * borders, hover backgrounds, and — critically — the text of dropdown
     * options and social buttons. It defaults to a dark neutral, which is
     * correct on Clerk's default light card and produces black-on-obsidian
     * everywhere here: the "Continue with Google" label and the "Manage
     * account" / "Sign out" rows of the `<UserButton>` popover were both
     * unreadable until this was set.
     *
     * Light value = light generated shades. It is not a text colour itself;
     * setting `colorForeground` alone does not reach these elements.
     */
    colorNeutral: IVORY,

    colorInput: "rgba(255, 255, 255, 0.04)",
    colorInputForeground: IVORY,

    colorBorder: "rgba(255, 255, 255, 0.08)",
    colorRing: GOLD,
    colorShimmer: "rgba(200, 169, 106, 0.2)",
    colorShadow: "rgba(0, 0, 0, 0.45)",
    colorModalBackdrop: "rgba(0, 0, 0, 0.8)",

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
     * surface — so Clerk's own card drops its background and border rather
     * than painting a second box inside the first.
     */
    cardBox: {
      boxShadow: "none",
      border: "1px solid rgba(255, 255, 255, 0.08)",
    },
    card: {
      backgroundColor: SURFACE,
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
      "&:hover": { backgroundColor: CHAMPAGNE },
    },

    footerActionLink: {
      color: GOLD,
      "&:hover": { color: CHAMPAGNE },
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
