import Image from "next/image";
import Link from "next/link";

import { collections, world } from "@/src/constants/navigation-pages";

const footerLinkClass =
  "text-xs tracking-[0.05em] text-ivory/40 no-underline transition-colors duration-300 hover:text-gold";

const socialLinkClass =
  "text-[10px] tracking-[0.15em] text-ivory/35 no-underline transition-colors duration-300 hover:text-gold";

const legalLinkClass =
  "text-[11px] tracking-[0.08em] text-ivory/25 no-underline transition-colors duration-300 hover:text-ivory/60";

const collectionLinks = [
  ...collections.map((c) => ({ label: c.label, path: c.path })),
  { label: "New Arrivals", path: "/collections" },
  { label: "Best Sellers", path: "/collections" },
];

const worldLinks = [
  ...world.map((w) => ({
    label: w.label === "Journal" ? "The Journal" : w.label,
    path: w.path,
  })),
  { label: "Stockists", path: "/stockists" },
  { label: "Contact", path: "/contact" },
];

const accountLinks = [
  { label: "My Account", path: "/account" },
  { label: "My Orders", path: "/account" },
  { label: "Wishlist", path: "/wishlist" },
  { label: "Track Order", path: "/account" },
  { label: "Returns & Exchanges", path: "/return-exchange" },
];

const socialLinks = ["Instagram", "Facebook", "Pinterest"] as const;

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms-conditions" },
  { label: "Returns & Exchanges", href: "/return-exchange" },
  { label: "Cookie Policy", href: "/cookie-policy" },
] as const;

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--color-border)] bg-background pt-20">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-16 px-6 pb-20 md:px-20 lg:grid-cols-[2fr_1fr_1fr_1fr] lg:gap-16">
        <div>
          <Link href="/" className="mb-7 inline-block no-underline">
            <Image
              src="logo/name-logo-transparent.svg"
              alt="KHEM Perfumes — Essence of Heritage"
              width={1273}
              height={540}
              className="h-16 w-auto"
            />
          </Link>
          <p className="mb-8 max-w-[300px] text-[13px] leading-[1.9] text-ivory/40">
            A luxury Egyptian fragrance house that transforms history, mythology,
            and ancient craftsmanship into timeless modern scents.
          </p>
          <div className="flex flex-wrap gap-5">
            {socialLinks.map((name) => (
              <a key={name} href="#" className={socialLinkClass}>
                {name}
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="eyebrow mb-7">Collections</p>
          <nav className="flex flex-col gap-3.5" aria-label="Collections">
            {collectionLinks.map((item) => (
              <Link
                key={`${item.label}-${item.path}`}
                href={item.path}
                className={footerLinkClass}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <p className="eyebrow mb-7">The World of KHEM</p>
          <nav className="flex flex-col gap-3.5" aria-label="The World of KHEM">
            {worldLinks.map((item) => (
              <Link key={item.label} href={item.path} className={footerLinkClass}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <p className="eyebrow mb-7">My Account</p>
          <nav
            className="mb-10 flex flex-col gap-3.5"
            aria-label="My Account"
          >
            {accountLinks.map((item) => (
              <Link key={item.label} href={item.path} className={footerLinkClass}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div>
            <p className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-ivory/25">
              Boutique
            </p>
            <p className="text-xs leading-[1.8] text-ivory/40">
              New Cairo
              <br />
              Cairo, Egypt
              <br />
              <a
                // href="tel:+20000000000"
                className="text-gold/70 no-underline transition-colors hover:text-gold"
              >
                {/* +20 00 000 0000 */} Coming Soon...
              </a>
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 border-t border-[var(--color-border)] px-6 py-6 md:flex-row md:items-center md:px-20">
        <p className="text-[11px] tracking-[0.1em] text-ivory/25">
          © {year} KHEM Fragrance House. All rights reserved.
        </p>
        <div className="flex flex-wrap gap-7">
          {legalLinks.map((item) => (
            <Link key={item.label} href={item.href} className={legalLinkClass}>
              {item.label}
            </Link>
          ))}
        </div>
        <p className="text-[11px] tracking-[0.08em] text-ivory/20">
          Crafted with reverence in Cairo
        </p>
      </div>
    </footer>
  );
}
