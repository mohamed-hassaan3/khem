/**
 * One figure on the Sales & Profitability overview.
 *
 * A Server Component: nothing here is interactive, and the accounting words are
 * the point. Each tile carries a `note` because the vocabulary is genuinely
 * confusable — *Actual Revenue* and *Gross Profit* are different numbers and
 * calling either of them "profit" is how a boutique convinces itself it is
 * making money it is not.
 *
 * `tone` is deliberately restrained. Only the profit tile is ever gold, and a
 * negative one is the single place this dashboard uses the danger colour on a
 * number: a product sold below cost is not a styling opportunity, it is the one
 * thing on the screen somebody has to act on.
 */

import type { ReactNode } from "react";

export default function SalesFigure({
  label,
  value,
  note,
  tone = "plain",
}: {
  label: string;
  value: string;
  note?: ReactNode;
  tone?: "plain" | "accent" | "muted" | "danger";
}) {
  const valueTone =
    tone === "accent"
      ? "text-ground-accent"
      : tone === "danger"
        ? "text-danger"
        : tone === "muted"
          ? "text-ground-muted"
          : "text-ground";

  return (
    <div className="border border-ground-border p-6">
      <p className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
        {label}
      </p>
      <p
        className={`mt-3 font-heading text-xl tracking-[0.08em] sm:text-2xl ${valueTone}`}
      >
        {value}
      </p>
      {note ? (
        <p className="mt-2 text-[11px] leading-relaxed tracking-wide text-ground-muted">
          {note}
        </p>
      ) : null}
    </div>
  );
}
