import { ClerkProvider } from "@clerk/nextjs";
import { arSA } from "@clerk/localizations";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";

import Footer from "@/src/components/Footer";
import Nav from "@/src/components/Nav";
import CookieConsent from "@/src/components/consent/CookieConsent";
import CinematicIntro from "@/src/components/intro/CinematicIntro";
import CartDrawer from "@/src/components/ecommerce/CartDrawer";
import AnnouncementBar from "@/src/components/marketing/AnnouncementBar";
import OfferPopup from "@/src/components/marketing/OfferPopup";
import { khemClerkAppearance } from "@/src/lib/clerk-appearance";
import { getFontVariables } from "@/src/lib/fonts";
import {
  LOCALES,
  LOCALE_DIRECTION,
  LOCALE_HTML_TAG,
  OG_LOCALE,
  isLocale,
  localeAlternates,
  localizePath,
} from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { getDeliveryTerms } from "@/src/services/delivery";
import { getNavigationTree } from "@/src/services/navigation";
// One origin for the whole app. This used to be a second copy of the constant,
// which is how the root layout and every page's canonical could have come to
// disagree about which domain KHEM lives on.
import { SITE_URL } from "@/src/lib/i18n/metadata";
import { getSignupBenefit } from "@/src/services/benefits";
import {
  getLiveAnnouncements,
  getMarketingSettings,
} from "@/src/services/marketing";
import { CartDrawerProvider } from "@/src/providers/cart-drawer-provider";
import { CartProvider } from "@/src/providers/cart-provider";
import { ConsentProvider } from "@/src/providers/consent-provider";
import { CurrencyProvider } from "@/src/providers/currency-provider";
import { DeliveryProvider } from "@/src/providers/delivery-provider";
import { I18nProvider } from "@/src/providers/i18n-provider";
import { NavGroundProvider } from "@/src/providers/nav-ground-provider";

/**
 * Both locale trees are prerendered. Without this, the `[locale]` segment would
 * force every route into dynamic rendering.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

const KEYWORDS = {
  en: [
    "KHEM",
    "KHEM Perfumes",
    "Luxury Perfume",
    "Luxury Fragrance",
    "Egyptian Perfume",
    "Niche Perfume",
    "Luxury Egyptian Perfume",
    "Perfume Egypt",
    "Luxury Brand",
    "Luxury Scent",
    "Signature Perfume",
    "Premium Perfume",
    "Exclusive Perfume",
    "Eau de Parfum",
    "extrait de parfum",
    "Unisex Perfume",
    "Arabic Perfume",
    "Luxury Oud",
    "Fine Fragrance",
    "Perfume House",
    "Essence of Heritage",
  ],
  ar: [
    "كيم",
    "عطور كيم",
    "عطور فاخرة",
    "عطر فاخر",
    "عطور مصرية",
    "عطور نيش",
    "عطور مصرية فاخرة",
    "عطور مصر",
    "دار عطور",
    "عطر مميز",
    "أو دو بارفان",
    "إكستريه دو بارفان",
    "عطور للجنسين",
    "عطور عربية",
    "عود فاخر",
    "جوهر التراث",
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);

  return {
    metadataBase: new URL(SITE_URL),

    applicationName: "KHEM Perfumes",

    title: {
      default:
        locale === "ar"
          ? "عطور كيم | عطور مصرية فاخرة | جوهر التراث"
          : "KHEM Perfumes | Luxury Egyptian Perfumes | Essence of Heritage",
      template: locale === "ar" ? "%s | عطور كيم" : "%s | KHEM Perfumes",
    },

    description: dict.home.meta.description,

    keywords: KEYWORDS[locale],

    authors: [{ name: "KHEM Perfumes", url: `${SITE_URL}/` }],

    creator: "KHEM Perfumes",

    publisher: "KHEM Perfumes",

    category: "Luxury Perfume",

    alternates: localeAlternates(locale, "/"),

    robots: {
      index: true,
      follow: true,
      nocache: false,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-video-preview": -1,
        "max-snippet": -1,
      },
    },

    openGraph: {
      type: "website",
      locale: OG_LOCALE[locale],
      url: `${SITE_URL}${localizePath(locale, "/")}`,
      siteName: "KHEM Perfumes",
      title:
        locale === "ar"
          ? "عطور كيم | جوهر التراث"
          : "KHEM Perfumes | Essence of Heritage",
      description:
        locale === "ar"
          ? "عطور مصرية فاخرة مستوحاة من مصر القديمة. اكتشف مجموعات حصرية صُنعت بأناقة خالدة."
          : "Luxury Egyptian fragrances inspired by Ancient Egypt. Discover exclusive collections crafted with timeless elegance.",

      images: [
        {
          url: "/opengraph-image.png",
          width: 1200,
          height: 630,
          alt: "KHEM Perfumes",
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title:
        locale === "ar"
          ? "عطور كيم | جوهر التراث"
          : "KHEM Perfumes | Essence of Heritage",
      description:
        locale === "ar"
          ? "عطور مصرية فاخرة مستوحاة من التراث ومصنوعة للعالم المعاصر."
          : "Luxury Egyptian fragrances inspired by heritage and crafted for the modern world.",

      images: ["/opengraph-image.png"],
    },

    /*
     * No `icons` or `manifest` block on purpose.
     *
     * Of the six files the previous declaration advertised, only
     * `/favicon.ico` existed. The other five — `/icon.svg`, both PNG
     * favicons, `/apple-touch-icon.png`, `/site.webmanifest` — carry a file
     * extension, so `proxy.ts` lets them through to the App Router, where the
     * `[locale]/[...rest]` catch-all answered each one with a full ~62 KB
     * render of this layout. Four wasted page renders on every page view.
     *
     * Omitting the field lets Next's file-convention metadata emit the icon
     * link from `src/app/favicon.ico` instead; an explicit `metadata.icons`
     * would override that convention, which is why it had to go rather than
     * shrink. Re-add entries here once real assets land in `public/`.
     */

    appleWebApp: {
      capable: true,
      title: "KHEM",
      statusBarStyle: "black-translucent",
    },

    formatDetection: {
      telephone: false,
      email: false,
      address: false,
    },
  };
}

/**
 * `themeColor` belongs to the viewport export, not `metadata` — Next warns on
 * (and ignores) it in `generateMetadata`.
 */
export const viewport: Viewport = {
  themeColor: "#0D0D0D",
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // The segment is untrusted input — it reaches `lang`, `dir`, and the
  // dictionary loader, so narrow it before any of that.
  if (!isLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);

  /*
   * The two marketing surfaces, resolved on the server.
   *
   * Read here rather than inside the components because both are Client
   * Components and neither may hold a Supabase key — and because the *presence*
   * of a bar has to be known before the first paint, so `data-announcement`
   * below can size the header stack in the same HTML the bar arrives in. That is
   * what keeps this feature free of layout shift.
   *
   * All three reads are memoised per request and none of them uses a dynamic
   * API, so this layout stays prerenderable exactly as it was; an admin write
   * revalidates it through `revalidateMarketing()`.
   */
  const [marketing, announcements, signupBenefit, navTree, deliveryTerms] =
    await Promise.all([
    getMarketingSettings(locale),
    getLiveAnnouncements(locale),
    getSignupBenefit(),
    /*
     * The menu, which is data now (`supabase/sql/0048_navigation.sql`). Read
     * here rather than inside `<Nav>` because that component is a client one —
     * and read for the Nav's surface specifically, since a row may be offered
     * in the menu without being offered in the Footer's sitemap. The read
     * cannot fail: it falls back to the tree this repository ships.
     */
    getNavigationTree(locale, "nav"),
    /*
     * What delivery costs, for the bag and the checkout alike
     * (`supabase/sql/0053_delivery_terms.sql`). Read here for the same reason
     * the menu is: the four components that price delivery are all client ones,
     * and a total fetched after the first paint is not a flicker, it is a
     * misquote. Cached and revalidated like every other read above, and it
     * cannot fail — it falls back to the terms in `src/lib/cart.ts`.
     */
    getDeliveryTerms("ONLINE"),
  ]);

  const showAnnouncements =
    marketing.announcementsEnabled && announcements.length > 0;

  return (
    /*
     * `data-scroll-behavior="smooth"` is required, not decorative.
     *
     * `globals.css` sets `html { scroll-behavior: smooth }`. As of Next 16 the
     * router only neutralises that during a route transition when this
     * attribute is present; without it, the scroll-to-top it performs after a
     * navigation is handed to the CSS smooth-scroll animation, which the
     * incoming page's layout change then cancels. The visible symptom was
     * landing on the 404 page still pinned to the footer after clicking a dead
     * link from the bottom of a long page — the scroll was issued, then lost.
     *
     * Next warns about exactly this in development.
     */
    <html
      lang={LOCALE_HTML_TAG[locale]}
      dir={LOCALE_DIRECTION[locale]}
      data-scroll-behavior="smooth"
      /*
       * Required by the intro's pre-paint script, which stamps `data-intro`
       * on this element *before* React hydrates. React then finds an attribute
       * on `<html>` that its server HTML does not have and reports a hydration
       * mismatch — "some attributes of the server rendered HTML didn't match
       * the client properties", naming `data-intro="off"`, on the second and
       * every subsequent load of a session.
       *
       * This is the price of answering "has this tab already seen the intro?"
       * ahead of the first paint, and it is the same bargain every pre-paint
       * theme script makes. Nothing is being papered over: the attribute is
       * *meant* to differ, because the server cannot know the answer.
       *
       * The prop is deliberately narrow — it suppresses the warning for this
       * element's own attributes and text only, one level deep. It does not
       * apply to `<body>`, to the providers, or to any page below.
       */
      suppressHydrationWarning
    >
      <body
        /*
         * Sizes `--announcement-h` (see `globals.css`), which `<Nav>`'s `top`
         * and the page wrapper below both read. An attribute rather than an
         * inline style so the two breakpoint values live in the stylesheet
         * beside the bar they describe.
         */
        data-announcement={showAnnouncements ? "on" : undefined}
        className={`${getFontVariables(locale)} font-body antialiased`}
      >
        {/*
         * The intro's suppression decision, made before the browser paints.
         *
         * `<CinematicIntro>` ships in the server HTML precisely so that a first
         * visitor never sees a frame of the real site before the curtain. The
         * cost of that is a *returning* visitor would see a frame of the
         * curtain before React could remove it — so the question "has this tab
         * already seen it?" has to be answered by the document itself, ahead of
         * the first paint.
         *
         * Inline and render-blocking rather than `next/script`: every strategy
         * that library offers, `beforeInteractive` included, resolves after the
         * first paint, which is the one thing this cannot do. It is one
         * statement and it interpolates nothing — the string below is a
         * constant, so no request data can reach `dangerouslySetInnerHTML`.
         *
         * First child of `<body>` rather than a hand-written `<head>`, which
         * the App Router owns.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(sessionStorage.getItem('khem:intro:seen'))document.documentElement.dataset.intro='off'}catch(e){}",
          }}
        />

        {/*
         * `<ClerkProvider>` sits inside `<body>` — required by Clerk v7, where
         * wrapping `<html>` (the Core 2 pattern) no longer works — and
         * outermost of the providers, because `<UserButton>` in `Nav` and
         * every account island need it in scope.
         *
         * The `dynamic` prop is deliberately **not** set. It opts the whole
         * subtree into reading auth state during the render, which turns every
         * route on the site dynamic — the build output went from prerendered
         * pages to `ƒ` on all thirty of them, an invocation per view on pages
         * that have no session data to show. The routes that do read the
         * session declare `force-dynamic` themselves and call `auth()` there,
         * which is all Clerk needs.
         *
         * The auth URLs are built per-locale, which is the whole reason this
         * provider lives in the `[locale]` layout instead of a root one. With
         * `as-needed` prefixing an Arabic visitor must be redirected to
         * `/ar/sign-in` and returned to `/ar/account` — a single hardcoded
         * `/sign-in` would drop them into the English tree mid-flow.
         */}
        <ClerkProvider
          appearance={khemClerkAppearance}
          localization={locale === "ar" ? arSA : undefined}
          signInUrl={localizePath(locale, "/sign-in")}
          signUpUrl={localizePath(locale, "/sign-up")}
          signInFallbackRedirectUrl={localizePath(locale, "/account")}
          signUpFallbackRedirectUrl={localizePath(locale, "/account")}
        >
          {/*
           * The cart wraps the whole tree, not just the page that lists it:
           * the Nav badge, the PDP buy block, and the add-to-bag control on
           * every card in the collection grid all read the same state, and
           * they live on every route.
           *
           * It is a client provider holding `localStorage`-backed state, which
           * does not turn `children` into client components — a Server
           * Component passed through as `children` stays server-rendered.
           */}
          <I18nProvider locale={locale} dictionary={dictionary}>
            {/*
             * Consent wraps the cart rather than nesting inside it: the
             * footer's "Cookie Settings" trigger and the banner itself both
             * need it, and it must outlive any surface that might one day be
             * gated on a stored choice.
             */}
            <ConsentProvider>
              {/*
               * Currency wraps the shop the way I18n wraps the site: every
               * price, in the catalog and in the bag alike, has to read one
               * value. It renders USD on the server and swaps after hydration
               * — which is what keeps these routes prerendered (see
               * `currency-provider.tsx`).
               */}
              <CurrencyProvider>
                {/*
                 * Delivery sits between currency and the bag: it is priced in
                 * piastres and displayed through `formatPrice`, so it needs the
                 * currency above it, and every surface that quotes it — the
                 * drawer, the cart page, the checkout — is inside the cart.
                 */}
                <DeliveryProvider terms={deliveryTerms}>
                <CartProvider>
                  {/*
                   * Panel visibility, nested inside the cart rather than
                   * merged into it: one is persisted domain state, the other a
                   * boolean about the current viewport. It is a provider and
                   * not `useState` in `<Nav>` because two unrelated subtrees
                   * open the same panel — the header bag and the add-to-bag
                   * control on every product card.
                   */}
                  <CartDrawerProvider>
                    {/*
                     * Wraps `<Nav>` *and* `{children}`, because the declaration
                     * comes from a page and the reader is the header — they have
                     * to share a provider, and the header is not an ancestor of
                     * the page. See `providers/nav-ground-provider.tsx`.
                     */}
                    <NavGroundProvider>
                    {showAnnouncements ? (
                      <AnnouncementBar
                        announcements={announcements}
                        mode={marketing.announcementMode}
                        intervalMs={marketing.announcementIntervalMs}
                      />
                    ) : null}
                    <Nav tree={navTree} />
                    {/*
                     * The offset for the whole fixed header stack — the
                     * announcement bar *and* the nav bar, not just the bar
                     * above the nav.
                     *
                     * This is what puts every page's first pixel below the
                     * header instead of behind it: banners begin where the nav
                     * ends, and nothing is ever hidden under it. It replaces
                     * the `pt-20` that a dozen pages each carried privately —
                     * one declaration that follows `--nav-h` responsively,
                     * rather than twelve hard-coded copies of one breakpoint's
                     * value.
                     *
                     * `--header-h` collapses to the nav's height alone when no
                     * announcement bar is rendered. See `globals.css`.
                     */}
                    <div className="pt-[var(--header-h)]">{children}</div>
                    <Footer locale={locale} />
                    {/*
                     * Mounted once here rather than inside `<Nav>`: it is a
                     * modal dialog over the whole document, and it is opened
                     * from the product grid as well as from the header.
                     */}
                    <CartDrawer />
                    {/*
                     * Last in the tree, and `fixed`, so it never participates
                     * in document flow and cannot contribute to CLS.
                     */}
                    <CookieConsent />
                    {/*
                     * After the cookie banner in the tree, and gated on it
                     * having been answered — see `OfferPopup.tsx`. Two modals
                     * arriving together is the aggression the brief rules out.
                     */}
                    {marketing.offerPopupEnabled ? (
                      <OfferPopup settings={marketing} benefit={signupBenefit} />
                    ) : null}
                    </NavGroundProvider>
                  </CartDrawerProvider>
                </CartProvider>
                </DeliveryProvider>
              </CurrencyProvider>
            </ConsentProvider>
          </I18nProvider>
        </ClerkProvider>

        {/*
         * The house entrance. Last in the document and outside every provider,
         * because it consumes no context and must be able to cover all of them
         * — including `<CartDrawer>` and the mega-menu.
         *
         * `fixed` and nothing else, so like `<CookieConsent>` above it it never
         * enters the flow and cannot contribute to CLS. It plays on the first
         * document load of a session; client-side navigation cannot replay it,
         * because this layout persists across route changes rather than
         * remounting.
         */}
        <CinematicIntro />
      </body>
    </html>
  );
}
