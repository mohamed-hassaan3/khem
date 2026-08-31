import { ArrowLeft } from "lucide-react";

import AdminLink from "@/src/components/admin/AdminLink";

/**
 * The way back up one level of the CMS.
 *
 * Content is the only part of the dashboard more than one level deep, so a page
 * inside it has to say what it is inside of — the rail alone leaves an editor
 * three clicks from anywhere with no sense of where "up" is.
 */
export default function ContentBackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <AdminLink
      href={href}
      className="mb-6 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
    >
      <ArrowLeft size={13} strokeWidth={1.25} aria-hidden />
      {label}
    </AdminLink>
  );
}
