"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useEffect } from "react";

import { useSessionPublish } from "@/src/providers/session-provider";

/**
 * Reads Clerk and reports it to `<SessionProvider>`. Renders nothing.
 *
 * Lives inside whichever `<ClerkProvider>` the page has — the background
 * `<ClerkSessionBridge>` on public pages, or `<KhemClerkProvider>` on
 * `/sign-in`, `/sign-up` and `/account` — so the header (which sits above both)
 * always sees the same session. Withdraws its report when unmounted, e.g. on
 * a client navigation from `/account` back to a public page.
 */
export default function SessionPublisher() {
  const { isLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();
  const publish = useSessionPublish();

  const fullName = user?.fullName?.trim() || null;
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const imageUrl = user?.imageUrl ?? null;
  const hasImage = user?.hasImage ?? false;

  useEffect(() => {
    publish({
      status: !isLoaded ? "loading" : isSignedIn ? "signed-in" : "signed-out",
      user: isSignedIn ? { fullName, email, imageUrl, hasImage } : null,
      signOut: async (redirectUrl: string) => {
        await clerk.signOut({ redirectUrl });
      },
    });
  }, [publish, clerk, isLoaded, isSignedIn, fullName, email, imageUrl, hasImage]);

  useEffect(() => () => publish(null), [publish]);

  return null;
}
