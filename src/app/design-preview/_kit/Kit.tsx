import type { ReactNode } from "react";

/**
 * The furniture the showcase is built from — headings, swatches, annotation
 * panels, device frames.
 *
 * Deliberately *not* the design system. These are the labels and rules around
 * the specimens; the specimens themselves are drawn from `--k-*` tokens only.
 * Keeping the two apart means the chrome of this page can be as plain as it
 * likes without muddying what is being proposed.
 */

/* ── Structure ──────────────────────────────────────────────── */

export function Section({
  id,
  index,
  title,
  intent,
  children,
}: {
  id: string;
  index: string;
  title: string;
  /** One line on what the section is arguing for. Shown under the title. */
  intent: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-16 border-t border-[var(--k-line-light)] px-5 py-16 sm:px-8 md:py-24 lg:px-14"
    >
      <header className="mb-10 md:mb-14">
        <p className="k-sans text-[10px] font-medium uppercase tracking-[0.3em] text-[var(--k-on-light-accent)]">
          {index}
        </p>
        <h2 className="k-serif mt-3 text-2xl tracking-[0.08em] text-[var(--k-on-light)] sm:text-3xl">
          {title}
        </h2>
        <div className="k-rule mt-5" />
        <p className="k-sans mt-5 max-w-2xl text-[13px] leading-relaxed text-[var(--k-on-light-muted)]">
          {intent}
        </p>
      </header>
      {children}
    </section>
  );
}

/** A titled sub-block inside a section. */
export function Block({
  title,
  note,
  children,
  className = "",
}: {
  title: string;
  note?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-12 last:mb-0 ${className}`}>
      <h3 className="k-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--k-on-light)]">
        {title}
      </h3>
      {note ? (
        <p className="k-sans mt-2 max-w-2xl text-[12px] leading-relaxed text-[var(--k-on-light-muted)]">
          {note}
        </p>
      ) : null}
      <div className="mt-5">{children}</div>
    </div>
  );
}

/**
 * A specimen stage.
 *
 * `ground` decides which of the four grounds the specimen sits on, which is
 * the single most important thing to be able to flip: nearly every component
 * in this system has to work on at least two of them.
 */
export function Stage({
  ground = "cream",
  label,
  children,
  className = "",
}: {
  ground?: "light" | "cream" | "sand" | "dark" | "charcoal";
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const GROUND = {
    light: "k-light",
    cream: "k-cream",
    sand: "k-sand",
    dark: "k-dark",
    charcoal: "k-charcoal",
  } as const;

  return (
    <div className="border border-[var(--k-line-light)]">
      {label ? (
        <p className="k-sans border-b border-[var(--k-line-light)] bg-[var(--k-ivory)] px-4 py-2 text-[9px] font-medium uppercase tracking-[0.22em] text-[var(--k-on-light-muted)]">
          {label}
        </p>
      ) : null}
      <div className={`${GROUND[ground]} ${className}`}>{children}</div>
    </div>
  );
}

/** Two stages side by side — the "same component, both grounds" comparison. */
export function Pair({ children }: { children: ReactNode }) {
  return <div className="grid gap-6 lg:grid-cols-2">{children}</div>;
}

/* ── Annotation ─────────────────────────────────────────────── */

/** A rule the reviewer is being asked to approve, not a description. */
export function Rule({ children }: { children: ReactNode }) {
  return (
    <p className="k-sans mt-4 border-s-2 border-[var(--k-gold)] ps-4 text-[12px] leading-relaxed text-[var(--k-on-light-muted)]">
      {children}
    </p>
  );
}

/** Marks a specimen as a departure from what is on the site today. */
export function Change({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  return (
    <div className="k-sans mt-4 flex flex-col gap-2 border border-[var(--k-line-gold)] bg-[rgba(176,141,87,0.05)] p-4 text-[12px] leading-relaxed sm:flex-row sm:items-start sm:gap-5">
      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--k-on-light-accent)]">
        Change
      </span>
      <span className="text-[var(--k-on-light-muted)]">
        <span className="line-through decoration-[var(--k-on-light-muted)]/50">
          {from}
        </span>{" "}
        <span aria-hidden>→</span>{" "}
        <span className="font-medium text-[var(--k-on-light)]">{to}</span>
      </span>
    </div>
  );
}

/* ── Colour ─────────────────────────────────────────────────── */

export function Swatch({
  name,
  hex,
  role,
  border = false,
}: {
  name: string;
  hex: string;
  role: string;
  /** Light swatches need an edge or they dissolve into the page. */
  border?: boolean;
}) {
  return (
    <div>
      <div
        className={`h-24 w-full ${border ? "border border-[var(--k-line-light)]" : ""}`}
        style={{ background: hex }}
      />
      <p className="k-serif mt-3 text-[13px] tracking-[0.1em] text-[var(--k-on-light)]">
        {name}
      </p>
      <p className="k-sans mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--k-on-light-accent)]">
        {hex}
      </p>
      <p className="k-sans mt-2 text-[12px] leading-relaxed text-[var(--k-on-light-muted)]">
        {role}
      </p>
    </div>
  );
}

/* ── Devices ────────────────────────────────────────────────── */

/**
 * A fixed-width viewport, so desktop and phone renderings of the same surface
 * can be read on one screen.
 *
 * The frame is a real `width`, not a transform: the specimen inside genuinely
 * lays out at 390px, so its breakpoints resolve the way they would on a phone.
 * The trade-off is that the frame's contents cannot use the page's own `sm:`
 * / `lg:` prefixes to respond — inside a frame, those track the *browser*
 * width, not the frame's — so every framed specimen states its columns
 * explicitly.
 */
export function Device({
  kind,
  children,
}: {
  kind: "phone" | "tablet" | "desktop";
  children: ReactNode;
}) {
  const SPEC = {
    phone: { w: 390, label: "Phone — 390 × 844" },
    tablet: { w: 834, label: "Tablet — 834 × 1112" },
    desktop: { w: 1280, label: "Desktop — 1280 +" },
  } as const;

  const { w, label } = SPEC[kind];

  return (
    <figure className="min-w-0">
      <figcaption className="k-sans mb-3 text-[9px] font-medium uppercase tracking-[0.22em] text-[var(--k-on-light-muted)]">
        {label}
      </figcaption>
      {/* Scrolls rather than pushing the page sideways when the frame is wider
          than the column it sits in. */}
      <div className="overflow-x-auto">
        <div
          style={{ width: w }}
          className="max-w-none border border-[var(--k-line-light)] shadow-[var(--k-shadow-2)]"
        >
          {children}
        </div>
      </div>
    </figure>
  );
}
