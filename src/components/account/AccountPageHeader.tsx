import type { ReactNode } from "react";

/**
 * The head of every account panel: eyebrow, title, an optional line beneath,
 * and an action at the reading end (the notification bell).
 *
 * `display` is Home's greeting, which runs larger on desktop. The title is
 * `font-heading`, which is Cinzel in English and Amiri in Arabic — the locale
 * layout swaps the variable, so this component never branches on language.
 */
export interface AccountPageHeaderProps {
  eyebrow: string;
  heading: string;
  /** A short line under the title — Orders' totals, the Wallet's promise. */
  aside?: ReactNode;
  /** The bell, usually. Sits at the reading end, aligned to the title. */
  action?: ReactNode;
  size?: "default" | "display";
}

export default function AccountPageHeader({
  eyebrow,
  heading,
  aside,
  action,
  size = "default",
}: AccountPageHeaderProps) {
  return (
    <header className="acct-rise mb-6 flex items-end justify-between gap-4 md:mb-10">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>

        <h1
          className={[
            "mt-1.5 font-heading font-normal leading-[1.1] text-ground",
            size === "display" ? "text-[28px] lg:text-[40px]" : "text-[28px] lg:text-[34px]",
          ].join(" ")}
        >
          {heading}
        </h1>

        {aside ? (
          <div className="mt-2 text-[12px] leading-relaxed text-ground-muted">{aside}</div>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
