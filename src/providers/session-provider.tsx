"use client";

/**
 * Who is signed in — without loading Clerk for visitors who aren't.
 *
 * (prompts/clerk-load-only-where-needed.md)
 *
 * Every public page used to load Clerk (~350 KB of JavaScript) because one
 * `<ClerkProvider>` wrapped the whole site. Most visitors are signed out and
 * never needed it. This context is what the header, the account menu, the
 * comment form and the sign-out buttons read instead of Clerk's hooks:
 *
 * - **Signed out** — Clerk's `__client_uat` cookie is absent or `0` — Clerk is
 *   never imported. `status` is `"signed-out"`.
 * - **Signed in** — Clerk is loaded once, in the background, by
 *   `<ClerkSessionBridge>` (a sibling, not a wrapper, so nothing re-mounts when
 *   it arrives). It keeps the 60-second session token fresh, which is what lets
 *   checkout, discounts, offers and comments keep recognising the customer
 *   on the server, and it publishes the user and `signOut` here.
 * - **On `/sign-in`, `/sign-up`, `/account`** a full provider lives in the
 *   segment layout (`<KhemClerkProvider>`) and publishes here itself; the
 *   bridge is not mounted, so a page never has two providers.
 *
 * The cookie only decides *whether to load Clerk*. It is never trusted for
 * identity: the server (`auth()`, `requireAdmin()`) remains the only judge.
 */

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { Locale } from "@/src/lib/i18n/config";

export interface KhemSessionUser {
  fullName: string | null;
  email: string | null;
  imageUrl: string | null;
  hasImage: boolean;
}

/** What a Clerk-backed publisher reports. */
export interface PublishedSession {
  status: "loading" | "signed-in" | "signed-out";
  user: KhemSessionUser | null;
  signOut: (redirectUrl: string) => Promise<void>;
}

export interface KhemSession extends PublishedSession {
  /** False when Clerk has not been loaded on this page at all. */
  clerkActive: boolean;
}

interface SessionContextValue {
  session: KhemSession;
  publish: (session: PublishedSession | null) => void;
}

const noopSignOut = async () => undefined;

const SessionContext = createContext<SessionContextValue | null>(null);

const ClerkSessionBridge = dynamic(
  () => import("@/src/components/auth/ClerkSessionBridge"),
  { ssr: false },
);

/** Routes whose segment layout carries its own full `<ClerkProvider>`. */
const CLERK_ROUTE = /^(?:\/ar)?\/(?:sign-in|sign-up|account)(?:\/|$)/;

/**
 * Does the browser hold a Clerk session? `__client_uat` (and the per-instance
 * `__client_uat_<suffix>`) is a timestamp while signed in and `0` once signed
 * out; a visitor who never signed in has none.
 */
function hasClerkSessionHint(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((part) => {
    const [rawName, rawValue = ""] = part.trim().split("=");
    if (rawName !== "__client_uat" && !rawName.startsWith("__client_uat_")) return false;
    const value = Number(rawValue);
    return Number.isFinite(value) && value > 0;
  });
}

/** Re-read the cookie when the tab returns (sign-in/out in another tab). */
function subscribeToSessionHint(onChange: () => void): () => void {
  const onVisible = () => {
    if (document.visibilityState === "visible") onChange();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}

export function SessionProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const onClerkRoute = CLERK_ROUTE.test(pathname);

  /*
   * The cookie as an external store. `null` on the server and during
   * hydration, so both agree on "loading" — which the header renders exactly
   * as it renders "signed out". After that it is re-read on every render
   * (so after each navigation, e.g. sign-in completing on `/sign-in`) and
   * whenever the tab becomes visible again.
   */
  const hint = useSyncExternalStore<boolean | null>(
    subscribeToSessionHint,
    hasClerkSessionHint,
    () => null,
  );
  const [published, setPublished] = useState<PublishedSession | null>(null);

  const publish = useCallback((session: PublishedSession | null) => {
    setPublished(session);
  }, []);

  const mountBridge = hint === true && !onClerkRoute;

  const session = useMemo<KhemSession>(() => {
    if (published) return { ...published, clerkActive: true };
    if (hint === null) {
      return { status: "loading", user: null, signOut: noopSignOut, clerkActive: false };
    }
    if (hint === false && !onClerkRoute) {
      return { status: "signed-out", user: null, signOut: noopSignOut, clerkActive: false };
    }
    return { status: "loading", user: null, signOut: noopSignOut, clerkActive: false };
  }, [published, hint, onClerkRoute]);

  const value = useMemo(() => ({ session, publish }), [session, publish]);

  return (
    <SessionContext.Provider value={value}>
      {children}
      {mountBridge ? <ClerkSessionBridge locale={locale} /> : null}
    </SessionContext.Provider>
  );
}

/** The current session. Never loads Clerk by itself. */
export function useKhemSession(): KhemSession {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useKhemSession() must be used inside <SessionProvider>.");
  }
  return context.session;
}

/** For `<SessionPublisher>` only. */
export function useSessionPublish(): (session: PublishedSession | null) => void {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("<SessionPublisher> must be rendered inside <SessionProvider>.");
  }
  return context.publish;
}
