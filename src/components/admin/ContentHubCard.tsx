import { ArrowRight } from "lucide-react";

import AdminLink from "@/src/components/admin/AdminLink";

/**
 * One destination on a Content hub.
 *
 * The CMS is navigated by asking "which page of the website am I editing?", so
 * the hubs are lists of *pages*, not lists of tables. This is the card that
 * answers, lifted verbatim from the panel `/admin/content` used to carry for
 * Ingredients — the pattern was already right, it was simply used once.
 *
 * `AdminLink` rather than `next/link`: a hub is reachable from inside a form,
 * and leaving one mid-edit must still ask.
 */
export default function ContentHubCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <AdminLink
      href={href}
      className="flex items-center justify-between gap-4 border border-ground-border bg-ivory/2 p-5 transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-gold/30 sm:p-6"
    >
      <span>
        <span className="block font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          {title}
        </span>
        <span className="mt-2 block text-[12px] leading-relaxed text-ground-muted">
          {description}
        </span>
      </span>
      <ArrowRight
        size={16}
        strokeWidth={1.25}
        aria-hidden
        className="shrink-0 text-ground-accent"
      />
    </AdminLink>
  );
}
