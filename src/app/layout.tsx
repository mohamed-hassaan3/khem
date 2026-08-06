import type { Metadata } from "next";
import "./globals.css";

import { headingFont, bodyFont } from "@/src/lib/fonts";
import Nav from "../components/Nav";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://khemperfumes.com"),

  applicationName: "KHEM Perfumes",

  title: {
    default: "KHEM Perfumes | Luxury Egyptian Perfumes | Essence of Heritage",
    template: "%s | KHEM Perfumes",
  },

  description:
    "Discover KHEM Perfumes, a luxury Egyptian fragrance house inspired by Ancient Egypt. Explore premium Eau de Parfum collections crafted with timeless elegance and exceptional artistry.",

  keywords: [
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
    "Unisex Perfume",
    "Arabic Perfume",
    "Luxury Oud",
    "Fine Fragrance",
    "Perfume House",
    "Essence of Heritage",
  ],

  authors: [
    {
      name: "KHEM Perfumes",
      url: "https://khemperfumes.com",
    },
  ],

  creator: "KHEM Perfumes",

  publisher: "KHEM Perfumes",

  category: "Luxury Perfume",

  alternates: {
    canonical: "/",
  },

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
    locale: "en_US",
    url: "https://khemperfumes.com",
    siteName: "KHEM Perfumes",
    title: "KHEM Perfumes | Essence of Heritage",
    description:
      "Luxury Egyptian fragrances inspired by Ancient Egypt. Discover exclusive collections crafted with timeless elegance.",

    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "KHEM Perfumes",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "KHEM Perfumes | Essence of Heritage",
    description:
      "Luxury Egyptian fragrances inspired by heritage and crafted for the modern world.",

    images: ["/og-image.jpg"],
  },

  icons: {
    icon: [
      {
        url: "/favicon.ico",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
    ],

    apple: "/apple-touch-icon.png",

    shortcut: "/favicon.ico",
  },

  manifest: "/site.webmanifest",

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

  themeColor: "#0D0D0D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${headingFont.variable} ${bodyFont.variable} bg-background font-body text-ivory antialiased`}
      >
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}