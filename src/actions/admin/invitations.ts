"use server";

/**
 * Inviting somebody to open an account.
 *
 * ## Clerk owns the invitation; the house owns the envelope
 *
 * `createInvitation` is called with **`notify: false`**, and the `url` it
 * returns — the one carrying the ticket — goes into KHEM's own letter. Clerk
 * still mints the ticket, holds the expiry, and decides whether the link is
 * still good; nothing about the mechanism moves into this repository. What
 * changes is that the person receives a letter from the house rather than one
 * from an identity provider they have never heard of.
 *
 * The link needs no new sign-up code: `SignUpForm` renders Clerk's prebuilt
 * `<SignUp>`, which consumes `__clerk_ticket` itself.
 *
 * ## Nothing is stored here
 *
 * No invitations table. Clerk is the register, and a second copy in Postgres
 * would be a second truth about who has been invited — with no way to tell which
 * was lying the day they disagreed.
 *
 * ## A failed letter revokes the invitation
 *
 * An invitation nobody was told about is worse than none: it reaches no one, and
 * it blocks re-inviting that address, because Clerk refuses a second invitation
 * for an address that already has a pending one. So if Resend will not take the
 * letter, the invitation goes with it.
 *
 * ## Trust model
 *
 * A Server Action is a public HTTP endpoint. `requireAdmin()` is the first
 * statement, exactly as in every sibling under this folder — a page having
 * rendered the form grants nothing. The action takes an address and a language
 * and nothing else: no role, no metadata, no user id.
 *
 * ## Logging
 *
 * The outcome, and Clerk's error code where there is one. **Never** the address.
 */

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { requireAdmin } from "@/src/lib/admin/auth";
import { sendInvitationMail } from "@/src/lib/email/send-welcome-mail";
import { isEmailConfigured } from "@/src/lib/email/client";
import { DEFAULT_LOCALE, isLocale, localizePath } from "@/src/lib/i18n/config";
import { SITE_URL } from "@/src/lib/i18n/metadata";
import { AUTH_PATHS } from "@/src/lib/routes";
import type { AdminActionResult } from "@/src/schemas/admin";
import {
  invitationIdSchema,
  inviteCustomerSchema,
  resendInvitationSchema,
} from "@/src/schemas/invitations";

import { fieldErrorsFrom } from "./shared";

/** Clerk's own default is 30; naming it here is what the letter can promise. */
const EXPIRES_IN_DAYS = 30;

/**
 * The site an invitation sends people back to.
 *
 * Production: always `SITE_URL`. In development an invitation is made by the
 * Clerk *development* instance, whose ticket the live site (production Clerk)
 * cannot recognise — sending it to `SITE_URL` produced "This link is no longer
 * valid or has already been used". So outside production it returns to the dev
 * server it was created on, and only when that host is local (localhost or a
 * LAN address); any other Host header falls back to `SITE_URL`, so a forged
 * header can never put a foreign address into an email.
 */
async function invitationOrigin(): Promise<string> {
  if (process.env.NODE_ENV === "production") return SITE_URL;
  const host = (await headers()).get("host") ?? "";
  return /^(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d{1,5})?$/.test(host)
    ? `http://${host}`
    : SITE_URL;
}

/** Clerk's error payloads carry a machine code worth branching on. */
function clerkErrorCode(cause: unknown): string | null {
  if (typeof cause !== "object" || cause === null) return null;

  const errors = (cause as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return null;

  const code = (errors[0] as { code?: unknown } | undefined)?.code;
  return typeof code === "string" ? code : null;
}

export async function inviteCustomer(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = inviteCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  if (!isEmailConfigured()) {
    // Refused before the invitation is created rather than after: an invitation
    // with no letter is the dead row this action exists to avoid.
    return {
      ok: false,
      message: "Email is not configured on this deployment, so no invitation was sent.",
    };
  }

  const locale = isLocale(parsed.data.locale) ? parsed.data.locale : DEFAULT_LOCALE;
  const email = parsed.data.email.trim().toLowerCase();

  const clerk = await clerkClient();

  let invitation;
  try {
    invitation = await clerk.invitations.createInvitation({
      emailAddress: email,
      /*
       * Where the ticket lands. Absolute, because it leaves in an email —
       * built from `invitationOrigin()` and the locale-aware sign-up path,
       * never from anything the form sent.
       */
      redirectUrl: `${await invitationOrigin()}${localizePath(locale, AUTH_PATHS.signUp)}`,
      /*
       * Lands on the user's `publicMetadata` when they accept, which is where
       * the webhook reads the language for their welcome letter. Public rather
       * than unsafe: the house set it and the user cannot rewrite it.
       */
      publicMetadata: { locale },
      expiresInDays: EXPIRES_IN_DAYS,
      // The house sends its own letter. See the header.
      notify: false,
      /*
       * Deliberately left at its default of false, so Clerk refuses an address
       * that already has an account or a pending invitation. Bypassing that
       * would let the desk quietly send a second invitation to somebody who is
       * already a customer.
       */
    });
  } catch (cause) {
    const code = clerkErrorCode(cause);
    console.error(`[invitations] create failed (${code ?? "unknown"}) by ${actor.email}`);

    if (code === "duplicate_record" || code === "identifier_already_signed_up") {
      return {
        ok: false,
        message: "That address already has an account or a pending invitation.",
        fieldErrors: { email: "Already invited or registered." },
      };
    }

    return { ok: false, message: "Clerk refused the invitation. Please try again." };
  }

  /*
   * `url` is optional on the response type. Without it there is nothing to put
   * in a letter, so the invitation is revoked rather than left dangling — the
   * same treatment a failed send gets, and for the same reason.
   */
  if (!invitation.url) {
    await revoke(clerk, invitation.id);
    console.error("[invitations] Clerk returned no url; revoked");
    return { ok: false, message: "Clerk returned no invitation link. Nothing was sent." };
  }

  const sent = await sendInvitationMail({
    to: email,
    locale,
    url: invitation.url,
    expiresInDays: EXPIRES_IN_DAYS,
  });

  if (!sent) {
    await revoke(clerk, invitation.id);
    console.error(`[invitations] letter not sent; invitation revoked (by ${actor.email})`);
    return {
      ok: false,
      message: "The invitation could not be emailed, so it was withdrawn. Please try again.",
    };
  }

  console.info(`[invitations] sent by ${actor.email}`);
  revalidatePath(INVITATIONS_PATH, "page");

  return {
    ok: true,
    // No slug to return — this writes nothing of ours. The field is part of the
    // shared result shape, and the id is the closest thing to a handle.
    slug: invitation.id,
    message: "Invitation sent.",
  };
}

/** Best-effort withdrawal. A revoke that fails must not mask why we are here. */
async function revoke(
  clerk: Awaited<ReturnType<typeof clerkClient>>,
  invitationId: string,
): Promise<void> {
  try {
    await clerk.invitations.revokeInvitation(invitationId);
  } catch (cause) {
    console.error(
      "[invitations] revoke failed:",
      cause instanceof Error ? cause.message : "unknown error",
    );
  }
}

const INVITATIONS_PATH = "/[locale]/admin/customers/invitations";

/**
 * Withdraw an invitation that has not been accepted. The link in the letter
 * stops working; nothing else changes. (prompts/admin-redesign-stage-6.md, 6b)
 */
export async function withdrawInvitation(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = invitationIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Unknown invitation." };

  const clerk = await clerkClient();
  try {
    await clerk.invitations.revokeInvitation(parsed.data.id);
  } catch (cause) {
    const code = clerkErrorCode(cause);
    console.error(`[invitations] withdraw failed (${code ?? "unknown"}) by ${actor.email}`);
    return {
      ok: false,
      message: "That invitation could not be withdrawn — it may already have been accepted.",
    };
  }

  console.info(`[invitations] withdrawn by ${actor.email}`);
  revalidatePath(INVITATIONS_PATH, "page");
  return { ok: true, slug: parsed.data.id, message: "Invitation withdrawn." };
}

/**
 * Send an invitation again: the old one is withdrawn (when it is still
 * pending) and a fresh one goes out through `inviteCustomer`, so the letter,
 * the 30-day window and every safeguard are the same as a first invitation.
 */
export async function resendInvitation(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = resendInvitationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That invitation could not be sent again." };

  const clerk = await clerkClient();
  try {
    await clerk.invitations.revokeInvitation(parsed.data.id);
  } catch {
    // Already revoked, expired or accepted: nothing to withdraw. An accepted
    // one is refused below by Clerk ("already signed up").
  }

  const outcome = await inviteCustomer({ email: parsed.data.email, locale: parsed.data.locale });
  console.info(`[invitations] resend ${outcome.ok ? "sent" : "refused"} by ${actor.email}`);
  revalidatePath(INVITATIONS_PATH, "page");
  return outcome.ok ? { ...outcome, message: "Invitation sent again." } : outcome;
}
