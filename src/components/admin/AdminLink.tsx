"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

import { useUnsavedChanges } from "@/src/providers/unsaved-changes-provider";

/**
 * A dashboard link that asks before abandoning unsaved work.
 *
 * `onNavigate` is the App Router's supported interception point: it runs only
 * for a client-side, same-origin navigation, and its event carries
 * `preventDefault()`. So this stops the navigation, opens the dialog, and — if
 * the answer is yes — performs the same navigation itself through the router.
 *
 * Nothing is intercepted when no editor has registered unsaved work, which is
 * every screen in the dashboard that is not a form mid-edit.
 *
 * ## What `onNavigate` deliberately does not cover
 *
 * A ⌘/Ctrl-click (Next.js hands that to the browser as a new tab, and a new tab
 * abandons nothing), an external URL, and a download link. Each of those leaves
 * the current page exactly where it is, so there is nothing to protect. The
 * cases that *do* lose work and are still not covered — Back, and a hard reload
 * — are documented in `unsaved-changes-provider.tsx`.
 *
 * `href` is narrowed to a string. The object form exists and the router accepts
 * it, but every href in this dashboard is built by `localizePath`, and a
 * deferred navigation has to be reproducible from what was captured.
 */

type AdminLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

export default function AdminLink({ href, ...props }: AdminLinkProps) {
  const router = useRouter();
  const { requestNavigation } = useUnsavedChanges();

  return (
    <Link
      href={href}
      onNavigate={(event) => {
        const held = requestNavigation(() => router.push(href));
        if (held) event.preventDefault();
      }}
      {...props}
    />
  );
}
