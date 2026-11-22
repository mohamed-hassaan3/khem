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
    // `items-start` + the action's top offset: the bell lines up with the
    // title, not with the subtitle line a panel may add beneath it.
    <header className="acct-rise mb-6 flex items-start justify-between gap-4 md:mb-10">
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

      {action ? (
        <div
          className={[
            "shrink-0",
            // Eyebrow (~22px incl. its gap) + half the title's line, less half
            // the 36px bell: centred on the first line of the h1.
            size === "display" ? "mt-[22px] lg:mt-[30px]" : "mt-[22px] lg:mt-[26px]",
          ].join(" ")}
        >
          {action}
        </div>
      ) : null}
    </header>
  );
}
