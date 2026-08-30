import { BagButton, Flacon, Flag, PriceTag } from "./Specimens";

/**
 * The proposed product card — §7 to §10 of the design document, drawn.
 *
 * ## The structural decisions being proposed
 *
 * **The card is a link, but not an `<a>` wrapping everything.** The live
 * `<ProductCard>` is one big anchor, which is why the bag control has to be
 * overlaid by whichever grid renders it — you cannot put a `<button>` inside
 * an `<a>`. Here the card is an `<article>` and the anchor is a *stretched*
 * overlay (`absolute inset-0`), so the bag button is a real sibling at a
 * higher z-index. Clicking the card navigates; clicking the bag does not
 * (§36), and no `stopPropagation` is needed to make that true — the two
 * targets simply do not overlap.
 *
 * **Equal height is structural, not a fixed pixel height.** The card is a
 * flex column; the description is clamped to two lines; the price row is
 * pushed down by `mt-auto`. So a product with no subtitle and a product with
 * a long one produce the same card, and the price row lines up across the
 * grid (§8) — without capping the card at a height that would break the day
 * somebody adds a fourth line.
 *
 * **Kind-agnostic.** `meta` takes the volume for a perfume, "3 × 10 ML" for a
 * discovery set, "Room Spray" for home fragrance. Nothing in the card assumes
 * a bottle (§10).
 */

export interface CardSpec {
  collection: string;
  name: string;
  description: string;
  price: string;
  was?: string;
  percent?: number;
  meta: string;
  flag?: { label: string; tone?: "gold" | "quiet" | "campaign" };
  soldOut?: boolean;
  capColor?: string;
}

export function ProductCardSpec({
  product,
  ground = "light",
  compact = false,
}: {
  product: CardSpec;
  ground?: "light" | "dark";
  /** The phone card: tighter padding, one less line of copy. */
  compact?: boolean;
}) {
  const dark = ground === "dark";

  return (
    <article className="k-card group relative flex h-full flex-col">
      <div
        className={`relative overflow-hidden ${
          product.soldOut ? "opacity-55 grayscale-[0.35]" : ""
        }`}
      >
        {product.flag ? (
          <Flag label={product.flag.label} tone={product.flag.tone} />
        ) : null}
        <Flacon
          tone={dark ? "dark" : "light"}
          cap={product.capColor ?? "var(--k-gold)"}
        />
      </div>

      <div
        className={`flex min-w-0 flex-1 flex-col ${compact ? "p-3.5" : "p-5"}`}
      >
        <p
          className={`k-sans text-[9px] font-medium uppercase tracking-[0.22em] ${
            dark
              ? "text-[var(--k-on-dark-accent)]"
              : "text-[var(--k-on-light-accent)]"
          }`}
        >
          {product.collection}
        </p>

        <h3
          className={`k-serif k-clamp-1 mt-2 tracking-[0.06em] ${
            compact ? "text-[13px]" : "text-[15px]"
          } ${dark ? "text-[var(--k-on-dark)]" : "text-[var(--k-on-light)]"}`}
        >
          {product.name}
        </h3>

        {/*
          Hidden on the two-up phone grid: at ~170px a description wraps to
          three lines and pushes the price below the fold of the card, which is
          the one thing on it a phone browser is scanning for.
        */}
        {!compact ? (
          <p
            className={`k-sans k-clamp-2 mt-2 text-[12px] leading-relaxed ${
              dark
                ? "text-[var(--k-on-dark-muted)]"
                : "text-[var(--k-on-light-muted)]"
            }`}
          >
            {product.description}
          </p>
        ) : null}

        {/* The spacer that makes the price rows line up across the grid. */}
        <div className="mt-auto" />

        <div
          className={`mt-4 flex items-end justify-between gap-3 border-t pt-3.5 ${
            dark
              ? "border-[var(--k-line-dark)]"
              : "border-[var(--k-line-light)]"
          }`}
        >
          <div className="min-w-0">
            <PriceTag
              price={product.price}
              was={product.was}
              percent={product.percent}
              ground={ground}
            />
            <p
              className={`k-sans mt-1.5 text-[10px] uppercase tracking-[0.16em] ${
                dark
                  ? "text-[var(--k-on-dark-muted)]"
                  : "text-[var(--k-on-light-muted)]"
              }`}
            >
              {product.meta}
            </p>
          </div>

          {/*
            Above the stretched link (`z-2` vs the anchor's `z-1`), so the
            pointer target here is the button and nothing else.
          */}
          <span className="relative z-2">
            <BagButton
              productName={product.name}
              ground={ground}
              soldOut={product.soldOut}
            />
          </span>
        </div>
      </div>

      {/*
        The stretched link. `#` because this is a preview; in production it is
        `productHref(product)`. It carries the accessible name of the card, so
        a screen reader announces one link per product rather than an
        unlabelled region followed by a bag button.
      */}
      <a
        href="#0"
        aria-label={`${product.name} — view details`}
        className="absolute inset-0 z-1 rounded-[var(--k-radius)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--k-gold)]"
      />
    </article>
  );
}

/* ── Sample catalogue ───────────────────────────────────────── */

/**
 * Deliberately uneven copy: one product with no description worth the name,
 * one with a description that overruns, one sold out, one on campaign. A grid
 * of four identical-length placeholders would prove nothing about §8.
 */
export const SAMPLE_PRODUCTS: readonly CardSpec[] = [
  {
    collection: "KHEM Noir",
    name: "Obsidian Oud",
    description:
      "Smoked oud over black amber and a long, resinous drydown that holds for a full day.",
    price: "EGP 4,800",
    meta: "100 ML",
    flag: { label: "Best Seller" },
  },
  {
    collection: "Signature",
    name: "Nile Iris",
    description: "Cold iris, papyrus, warm musk.",
    price: "EGP 3,200",
    was: "EGP 4,000",
    percent: 20,
    meta: "50 ML",
    flag: { label: "Ramadan Offer", tone: "campaign" },
    capColor: "#d4b77a",
  },
  {
    collection: "Gemstone",
    name: "Lapis",
    description:
      "Blue lotus and mineral salt held against a base of ambergris, cedar, and a trace of incense drawn from the temple resins of Upper Egypt.",
    price: "EGP 5,600",
    meta: "100 ML",
    capColor: "#3f5c8a",
  },
  {
    collection: "Discovery",
    name: "The Egyptica Set",
    description: "Six flacons, one from each house collection.",
    price: "EGP 1,400",
    meta: "6 × 10 ML",
    flag: { label: "Sold Out", tone: "quiet" },
    soldOut: true,
  },
];
