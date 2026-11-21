import LocaleLink from "@/src/components/i18n/LocaleLink";

/**
 * The phone header of a home band: eyebrow and a 22px title at the start, a
 * small gold text link at the end (Stage 2, `prompts/storefront-redesign-stage-2.md`
 * D4). From `md` the band keeps its own editorial header, so this renders
 * `md:hidden` and the band's original header is hidden below `md`.
 */
export default function HomeBandHeader({
  eyebrow,
  heading,
  linkHref,
  linkLabel,
  tone = "default",
}: {
  eyebrow: string;
  heading: string;
  linkHref?: string;
  linkLabel?: string;
  tone?: "default" | "inverse";
}) {
  return (
    <div className="mb-3.5 flex items-end justify-between gap-3 md:hidden">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h2
          className={`mt-1.5 font-heading text-[22px] font-normal leading-tight tracking-[0.02em] ${
            tone === "inverse" ? "text-ivory" : "text-ground"
          }`}
        >
          {heading}
        </h2>
      </div>
      {linkHref && linkLabel ? (
        <LocaleLink
          href={linkHref}
          className="inline-flex min-h-11 shrink-0 items-end pb-0.5 text-[11px] uppercase tracking-[0.14em] text-ground-accent no-underline"
        >
          {linkLabel}
        </LocaleLink>
      ) : null}
    </div>
  );
}
