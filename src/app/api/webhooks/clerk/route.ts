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

import { getSupabaseAdmin } from "@/src/lib/supabase";
import { subscribe, unsubscribeByClerkUser } from "@/src/services/newsletter";

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
