import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";

import Footer from "@/src/components/Footer";
import Nav from "@/src/components/Nav";
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
import { CartProvider } from "@/src/providers/cart-provider";
import { I18nProvider } from "@/src/providers/i18n-provider";
import { WishlistProvider } from "@/src/providers/wishlist-provider";

const SITE_URL = "https://khemperfumes.vercel.app";

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
    >
      <body
        className={`${getFontVariables(locale)} bg-background font-body text-ivory antialiased`}
      >
        {/*
         * Cart and wishlist wrap the whole tree, not just the two pages that
         * list them: the Nav badge, the PDP buy block, and the collection grid
         * hearts all read the same state, and they live on every route.
         *
         * Both are client providers holding `localStorage`-backed state, so
         * neither turns `children` into client components — a Server Component
         * passed through as `children` stays server-rendered.
         */}
        <I18nProvider locale={locale} dictionary={dictionary}>
          <CartProvider>
            <WishlistProvider>
              <Nav />
              {children}
              <Footer locale={locale} />
            </WishlistProvider>
          </CartProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
