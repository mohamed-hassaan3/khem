import { ShoppingBag } from "lucide-react";

/**
 * The proposed components themselves.
 *
 * These are **re-drawings**, not imports. Pulling in the live
 * `<ProductCard>` would only show what the site already looks like, and could
 * not show the card on an ivory ground at all — the whole point of the
 * exercise. Every specimen here is built from `--k-*` tokens and nothing else,
 * so what a reviewer sees is exactly what the token set produces.
 *
 * When the direction is approved, these become the reference for editing the
 * real components in `src/components/`. They are not themselves promoted into
 * production.
 */

/* ── Product imagery ────────────────────────────────────────── */

/**
 * A flacon, drawn rather than photographed.
 *
 * Product photography lives on Cloudinary and is loaded from the database; a
 * review page that reached for it would need a network, a seeded catalogue,
 * and credentials, and would then render differently for every reviewer. An
 * inline SVG is deterministic, weighs nothing, and is honest about being a
 * placeholder — which keeps the discussion on the frame, the type, and the
 * spacing, which is what is actually being decided.
 */
export function Flacon({
  tone = "light",
  cap = "var(--k-gold)",
}: {
  tone?: "light" | "dark" | "sand";
  cap?: string;
}) {
  const GROUND = {
    light: "linear-gradient(160deg, #efece4 0%, #e2ddd1 100%)",
    sand: "linear-gradient(160deg, #ece5d9 0%, #ddd4c2 100%)",
    dark: "linear-gradient(160deg, #232326 0%, #121214 100%)",
  } as const;

  const glass = tone === "dark" ? "#3a3a40" : "#cfc9bb";
  const glassTop = tone === "dark" ? "#4a4a52" : "#ded8ca";

  return (
    <div
      className="k-zoom relative aspect-3/4 w-full"
      style={{ background: GROUND[tone] }}
    >
      <svg
        viewBox="0 0 120 160"
        className="k-zoom-target absolute inset-0 h-full w-full"
        role="img"
        aria-label="Fragrance flacon, placeholder image"
      >
        <defs>
          <linearGradient id="k-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={glassTop} />
            <stop offset="55%" stopColor={glass} />
            <stop offset="100%" stopColor={glassTop} />
          </linearGradient>
        </defs>
        {/* Shoulder, body, and the small collar between them. */}
        <rect x="52" y="34" width="16" height="10" fill={cap} opacity="0.9" />
        <rect x="48" y="20" width="24" height="16" rx="1" fill={cap} />
        <path
          d="M42 46 h36 a6 6 0 0 1 6 6 v66 a6 6 0 0 1 -6 6 h-36 a6 6 0 0 1 -6 -6 v-66 a6 6 0 0 1 6 -6 z"
          fill="url(#k-glass)"
        />
        {/* One highlight, one label band. Enough to read as glass. */}
        <rect x="42" y="52" width="5" height="54" fill="#fff" opacity="0.28" />
        <rect x="46" y="86" width="28" height="18" fill={cap} opacity="0.18" />
      </svg>
    </div>
  );
}

/* ── The bag control ────────────────────────────────────────── */

/**
 * §9: the words "Add to Cart" leave the product card and an icon takes their
 * place.
 *
 * The label does not disappear with the text — it moves to `aria-label`, and
 * it names the product, because "Add to bag" repeated sixteen times down a
 * grid tells a screen-reader user nothing about which bag button they are on.
 */
export function BagButton({
  productName,
  ground = "light",
  soldOut = false,
}: {
  productName: string;
  ground?: "light" | "dark";
  soldOut?: boolean;
}) {
  const base =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--k-radius)] border transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--k-gold)]";

  const tone =
    ground === "dark"
      ? "border-[var(--k-line-dark)] text-[var(--k-on-dark)] hover:border-[var(--k-gold)] hover:bg-[var(--k-gold)] hover:text-[var(--k-obsidian)]"
      : "border-[var(--k-line-light)] text-[var(--k-on-light)] hover:border-[var(--k-obsidian)] hover:bg-[var(--k-obsidian)] hover:text-[var(--k-ivory)]";

  return (
    <button
      type="button"
      disabled={soldOut}
      aria-label={
        soldOut
          ? `${productName} — sold out`
          : `Add ${productName} to shopping bag`
      }
      className={`${base} ${tone} ${soldOut ? "cursor-not-allowed opacity-35" : "cursor-pointer"}`}
    >
      <ShoppingBag size={17} strokeWidth={1.25} aria-hidden />
    </button>
  );
}

/* ── Pricing ────────────────────────────────────────────────── */

/**
 * The house's only sale treatment: two numbers and a hairline strike. No red,
 * no burst, no shouting — the same restraint the live `<ProductPrice>` argues
 * for, restated in the proposed palette.
 */
export function PriceTag({
  price,
  was,
  percent,
  ground = "light",
  size = "md",
}: {
  price: string;
  was?: string;
  percent?: number;
  ground?: "light" | "dark";
  size?: "md" | "lg";
}) {
  const now =
    ground === "dark" ? "text-[var(--k-on-dark)]" : "text-[var(--k-on-light)]";
  const old =
    ground === "dark"
      ? "text-[var(--k-on-dark-muted)]"
      : "text-[var(--k-on-light-muted)]";
  const chip =
    ground === "dark"
      ? "border-[var(--k-line-gold)] text-[var(--k-gold)]"
      : "border-[var(--k-line-gold)] text-[var(--k-on-light-accent)]";

  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      {was ? (
        <span
          aria-label={`Was ${was}`}
          className={`k-sans text-[11px] tabular-nums line-through decoration-[0.5px] ${old}`}
        >
          {was}
        </span>
      ) : null}
      <span
        className={`k-serif tabular-nums tracking-[0.06em] ${now} ${
          size === "lg" ? "text-xl" : "text-[15px]"
        }`}
      >
        {price}
      </span>
      {percent ? (
        <span
          aria-hidden
          className={`k-sans border px-1.5 py-px text-[9px] font-medium uppercase tracking-[0.14em] ${chip}`}
        >
          −{percent}%
        </span>
      ) : null}
    </span>
  );
}

/* ── Corner flag ────────────────────────────────────────────── */

export function Flag({
  label,
  tone = "gold",
}: {
  label: string;
  /** `gold` = merchandiser's claim. `quiet` = sold out. `campaign` = a sale. */
  tone?: "gold" | "quiet" | "campaign";
}) {
  const TONES = {
    gold: "bg-[var(--k-gold)] text-[var(--k-obsidian)] border-transparent",
    quiet:
      "bg-[rgba(13,13,13,0.82)] text-[var(--k-on-dark-muted)] border-[var(--k-line-dark)] backdrop-blur-sm",
    campaign:
      "bg-[rgba(13,13,13,0.82)] text-[var(--k-gold)] border-[var(--k-line-gold)] backdrop-blur-sm",
  } as const;

  return (
    <span
      className={`k-sans absolute start-0 top-4 z-2 border px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] ${TONES[tone]}`}
    >
      {label}
    </span>
  );
}
