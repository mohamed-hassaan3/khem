/**
 * Clerk's side of the conversation.
 *
 * The only place `"User"` is written. Clerk owns identity; this endpoint keeps
 * Supabase's replica of it current so the dashboard can search customers and
 * the account portal can hold an address book, neither of which can call an
 * identity API once per row.
 *
 * ## Signature verification is the authentication
 *
 * This endpoint is public and unauthenticated in the ordinary sense: Clerk
 * cannot hold a session. What it can do is sign every request, and
 * `verifyWebhook` refuses anything whose signature does not match the raw
 * bytes. Two consequences, exactly as in the Stripe route beside it:
 *
 *  - **The body must not be pre-parsed.** `verifyWebhook` reads the request
 *    itself; re-serialising a parsed body changes its signature and there is no
 *    recovering from that.
 *  - **A missing secret is a 500, never a bypass.** An unconfigured deployment
 *    must refuse to write customer rows, not accept every unsigned request that
 *    claims to be Clerk.
 *
 * `src/proxy.ts` excludes `api` from its matcher, so nothing here is touched by
 * the locale rewrite and no middleware gate needs relaxing.
 *
 * ## The welcome letter
 *
 * `user.created` also welcomes the account, exactly once. The once-only part is
 * not a check in this file — it is a claim taken by `claim_welcome()` in
 * `supabase/sql/0030_welcome.sql`, which also writes the welcome voucher's
 * grant in the same transaction so the code in the letter is one the checkout
 * will honour. A letter that cannot be sent releases its claim and answers 500,
 * so Clerk's retry sends it rather than the customer losing it.
 *
 * ## Idempotency
 *
 * Clerk retries until it gets a 2xx and may deliver the same event twice even
 * after one. `sync_clerk_user()` upserts on `clerkId` and
 * `soft_delete_clerk_user()` claims once, so a redelivery is a no-op rather
 * than a duplicate customer.
 *
 * ## `unsafeMetadata` is untrusted input
 *
 * It is writable by the user it belongs to — which is correct for a preference
 * they own, and exactly why nothing here reads anything out of it except one
 * boolean, coerced. It can never influence a role, a price, or admin access:
 * dashboard authority lives in `ADMIN_EMAILS`, checked against a *verified*
 * primary email in `src/lib/admin/auth.ts`, and never in a customer row.
 *
 * ## Logging
 *
 * The Clerk id and the event type. **Never** the email, name or phone — those
 * are the reason `0024_customers.sql` grants the public roles nothing, and
 * copying them into a log defeats the point.
 */

import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";

import { isEmailConfigured } from "@/src/lib/email/client";
import { sendWelcomeMail } from "@/src/lib/email/send-welcome-mail";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/src/lib/i18n/config";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { subscribe, unsubscribeByClerkUser } from "@/src/services/newsletter";
import { claimWelcome, releaseWelcome } from "@/src/services/welcome";

/** Node, not Edge: the signature check needs Node's crypto. */
export const runtime = "nodejs";

/** Never cached, never prerendered — it is a write endpoint. */
export const dynamic = "force-dynamic";

/** The shape `sync_clerk_user()` takes. Assembled here, validated there. */
interface UserPayload {
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  marketingOptIn: boolean;
}

/** Clerk's user payload, narrowed to the parts this endpoint reads. */
interface ClerkUserData {
  id?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  primary_email_address_id?: unknown;
  email_addresses?: unknown;
  primary_phone_number_id?: unknown;
  phone_numbers?: unknown;
  unsafe_metadata?: unknown;
  /** Set by the house — through an invitation — and not writable by the user. */
  public_metadata?: unknown;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * The primary email, or the first one on file.
 *
 * Clerk sends every address with a pointer at the primary. Falling back to the
 * first is what keeps a user whose primary is mid-change from failing to sync;
 * `"User".email` is a contact detail here, never a credential, so the fallback
 * costs nothing. (`src/lib/admin/auth.ts` makes the opposite choice, and must:
 * there the address *is* the authority, so an unverified or non-primary one is
 * refused outright.)
 */
function primaryEmail(data: ClerkUserData): string | null {
  if (!Array.isArray(data.email_addresses)) return null;

  const entries = data.email_addresses as readonly {
    id?: unknown;
    email_address?: unknown;
  }[];

  const primary = entries.find((entry) => entry.id === data.primary_email_address_id);
  return text(primary?.email_address) ?? text(entries[0]?.email_address);
}

/** The primary phone, or the first. Optional everywhere it is used. */
function primaryPhone(data: ClerkUserData): string | null {
  if (!Array.isArray(data.phone_numbers)) return null;

  const entries = data.phone_numbers as readonly {
    id?: unknown;
    phone_number?: unknown;
  }[];

  const primary = entries.find((entry) => entry.id === data.primary_phone_number_id);
  return text(primary?.phone_number) ?? text(entries[0]?.phone_number);
}

/**
 * The one field read out of `unsafeMetadata`, coerced to a boolean.
 *
 * Written by `src/components/auth/SignUpForm.tsx` at account creation. A
 * truthy string, a number, or a missing object all resolve to something safe;
 * nothing else in that object is looked at.
 */
function marketingOptIn(data: ClerkUserData): boolean {
  if (typeof data.unsafe_metadata !== "object" || data.unsafe_metadata === null) {
    return false;
  }

  const value = (data.unsafe_metadata as Record<string, unknown>).marketingOptIn;
  return value === true || value === "true";
}

/**
 * The language to write to this person in.
 *
 * Clerk carries no locale of its own, so it is put there by us:
 * `SignUpForm` writes one into `unsafeMetadata` beside the marketing flag, and
 * an invitation carries one in `publicMetadata` that lands on the user when
 * they accept. Public is preferred — the house set it, the user cannot.
 *
 * Both are untrusted, and both are checked against the `LOCALES` allowlist. The
 * worst a forged value can do is pick the other supported language, which is
 * the point of validating against a closed set rather than sanitising a string.
 */
function localeFrom(data: ClerkUserData): Locale {
  for (const source of [data.public_metadata, data.unsafe_metadata]) {
    if (typeof source !== "object" || source === null) continue;

    const value = (source as Record<string, unknown>).locale;
    if (typeof value === "string" && isLocale(value)) return value;
  }

  return DEFAULT_LOCALE;
}

function payloadFrom(data: ClerkUserData): UserPayload | null {
  const clerkId = text(data.id);
  const email = primaryEmail(data);

  // Without both, the row would be meaningless and the function would raise.
  // A user genuinely mid-creation with no address yet is not an error worth
  // making Clerk retry over.
  if (!clerkId || !email) return null;

  return {
    clerkId,
    email,
    firstName: text(data.first_name),
    lastName: text(data.last_name),
    phone: primaryPhone(data),
    marketingOptIn: marketingOptIn(data),
  };
}

// `NextRequest`, not `Request`: `verifyWebhook` takes Clerk's `RequestLike`,
// which is the Next request type. It reads the raw body itself.
export async function POST(request: NextRequest): Promise<Response> {
  // Absent secret → 500. Verification would throw anyway; failing here says why.
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
    console.error("[clerk] CLERK_WEBHOOK_SIGNING_SECRET is not configured");
    return NextResponse.json({ error: "Webhooks are not configured." }, { status: 500 });
  }

  let event;
  try {
    event = await verifyWebhook(request);
  } catch (cause) {
    // Deliberately terse: an unsigned or replayed request is told nothing
    // beyond that it was refused.
    console.error(
      `[clerk] signature verification failed: ${
        cause instanceof Error ? cause.message : "unknown"
      }`,
    );
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // A 500 makes Clerk retry, which is what we want: the event is valid and
    // the failure is ours.
    console.error("[clerk] Supabase is not configured; user not synced");
    return NextResponse.json({ error: "Database unavailable." }, { status: 500 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const payload = payloadFrom(event.data as ClerkUserData);

    if (!payload) {
      console.warn(`[clerk] ${event.type} carried no id or email; skipped`);
      return NextResponse.json({ received: true });
    }

    const { error } = await supabase.rpc("sync_clerk_user", { payload });

    if (error) {
      console.error(`[clerk] sync_clerk_user failed: ${error.message}`);
      return NextResponse.json({ error: "Sync failed." }, { status: 500 });
    }

    /*
     * Keep the Inner Circle list in step with the box on their profile.
     *
     * Without this, `"User"."marketingOptIn"` and the subscriber list are two
     * records of the same consent that drift apart, and §13's rule that every
     * marketing email respects consent becomes unenforceable — the list would
     * be the thing that gets mailed while the flag is the thing that was
     * agreed to.
     *
     * Ticking it subscribes; clearing it unsubscribes. A withdrawal is a
     * withdrawal whichever surface the address arrived from, so this does not
     * check the source first — and `unsubscribe_newsletter`'s row survives
     * either way, so the consent history is not lost.
     *
     * Best-effort by construction: a list failure must not make Clerk retry an
     * event whose *identity* half already landed, which would re-run the sync
     * to no purpose.
     */
    if (payload.marketingOptIn) {
      await subscribe({
        email: payload.email,
        // Clerk carries no locale; `subscribe_newsletter` defaults to English
        // and the home-page form is what records a real preference.
        locale: "en",
        source: "SIGN_UP",
        clerkUserId: payload.clerkId,
      });
    } else {
      await unsubscribeByClerkUser(payload.clerkId);
    }

    /*
     * ── The welcome letter ──────────────────────────────────
     *
     * `user.created` only. It is the single activation signal for both paths
     * §8 describes: somebody who registers themselves, and somebody who accepts
     * an invitation, each produce exactly one of these. One trigger, one letter,
     * and no second code path to keep in step.
     *
     * **Transactional (§9.1).** It is about the account this person just
     * created, so it is sent whatever `marketingOptIn` says — the newsletter
     * reconciliation immediately above is the only thing consent governs.
     *
     * The claim is what makes it once-only: `claim_welcome()` takes it with a
     * conditional update and writes the voucher grant in the same transaction,
     * so a Clerk redelivery claims nothing and sends nothing, and the code in
     * the letter is one the checkout will honour.
     *
     * An unconfigured mailer does **not** claim. A claim taken where no letter
     * can be sent would silently burn this account's one chance to be welcomed.
     */
    if (event.type === "user.created" && isEmailConfigured()) {
      const claim = await claimWelcome(payload.clerkId);

      if (claim.claimed) {
        const sent = await sendWelcomeMail({
          to: claim.email,
          locale: localeFrom(event.data as ClerkUserData),
          firstName: claim.firstName,
          code: claim.code,
          expiresAt: claim.expiresAt,
        });

        if (!sent) {
          /*
           * Give the claim back and let Clerk retry the whole event. Everything
           * it does is idempotent — the sync upserts, the list reconciles, and
           * `claim_welcome()` reuses the grant it already wrote — so a retry
           * costs nothing and is the difference between a customer eventually
           * being welcomed and never being welcomed at all.
           *
           * Bounded by Clerk's own retry schedule, not by a loop here.
           */
          await releaseWelcome(payload.clerkId);
          console.error(`[clerk] welcome not sent for ${payload.clerkId}; released`);
          return NextResponse.json({ error: "Welcome not sent." }, { status: 500 });
        }

        // The id, and whether a privilege rode along. Never the address, the
        // name, or the code.
        console.info(
          `[clerk] welcomed ${payload.clerkId} (voucher: ${claim.code !== null})`,
        );
      }
    }

    console.info(`[clerk] ${event.type} synced ${payload.clerkId}`);
    return NextResponse.json({ received: true });
  }

  if (event.type === "user.deleted") {
    const clerkId = text((event.data as ClerkUserData).id);

    if (!clerkId) {
      console.warn("[clerk] user.deleted carried no id; skipped");
      return NextResponse.json({ received: true });
    }

    const { data, error } = await supabase.rpc("soft_delete_clerk_user", {
      clerk_id: clerkId,
    });

    if (error) {
      console.error(`[clerk] soft_delete_clerk_user failed: ${error.message}`);
      return NextResponse.json({ error: "Delete failed." }, { status: 500 });
    }

    // Deleting the account withdraws consent with it: an address the person
    // has just erased must not keep receiving letters because the list is a
    // separate table.
    await unsubscribeByClerkUser(clerkId);

    // False means it was already closed — a redelivery, not a problem.
    console.info(`[clerk] user.deleted closed ${clerkId} (claimed: ${data === true})`);
    return NextResponse.json({ received: true });
  }

  // Everything else is acknowledged and ignored, so Clerk stops retrying an
  // event this endpoint has no opinion about.
  return NextResponse.json({ received: true });
}
