"use server";

/**
 * The customer's address book — the write half of it.
 *
 * ## What this closes
 *
 * `"Address"` has existed since `supabase/sql/0024_customers.sql` and until now
 * nothing in the application ever wrote to it: the table, its indexes and
 * `getAddressesForUser()` were all in place, and every "Add", "Edit" and
 * "Remove" control had been deliberately withheld because there was no action
 * behind them. So an address typed at checkout was stored on the order — the
 * `ship*` snapshot columns, which are a record of where one parcel went and
 * must never move — and the address book stayed empty, correctly, for a reason
 * no screen could explain. This file is the missing half.
 *
 * ## The owner is never in the payload
 *
 * A Server Action is a public HTTP endpoint. None of these three accepts a
 * `userId`, a `clerkId` or an email: the session gives the Clerk id,
 * `ensureUserRowId()` resolves it to the `"User"` row the foreign key needs,
 * and **every write carries `.eq("userId", …)` with that resolved value**.
 * `supabase/sql/0024_customers.sql` revokes everything on `"Address"` from the
 * public roles and writes no RLS policy, so that filter *is* the access
 * control. A forged address id therefore matches zero rows rather than
 * somebody else's.
 *
 * ## Why they return the list
 *
 * Each action answers with the customer's addresses as they now stand, read
 * back through the same query the panel renders from. The panel is on a
 * `force-dynamic` route, so `revalidatePath` would buy nothing a re-render does
 * not already do, and a client holding the server's own answer cannot drift
 * from it the way an optimistic list can.
 *
 * ## One default, enforced by the database
 *
 * `address_one_default_idx` is a partial unique index: at most one row per
 * customer may carry `isDefault`. Promoting therefore clears before it sets,
 * never the other way round, and deleting the default promotes the oldest
 * survivor — a book with addresses and no default is a checkout with nothing
 * to preselect.
 */

import { getViewer } from "@/src/lib/auth";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  addressFieldErrors,
  addressIdSchema,
  addressInputSchema,
  type AddressErrorCode,
  type AddressField,
} from "@/src/schemas/address";
import { ensureUserRowId, getAddressesForUser } from "@/src/services/account";
import type { SavedAddress } from "@/src/types/account";

export type AddressResult =
  | { ok: true; addresses: readonly SavedAddress[] }
  | {
      ok: false;
      error: "unauthenticated" | "validation" | "failed";
      /** Present only for `validation`, keyed by the field that refused. */
      fieldErrors?: Partial<Record<AddressField, AddressErrorCode>>;
    };

/** The session, the `"User"` row id, and the Supabase client, or a failure. */
async function context(): Promise<
  | { ok: true; userId: string; supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>> }
  | { ok: false; error: "unauthenticated" | "failed" }
> {
  const viewer = await getViewer();
  if (viewer === null) return { ok: false, error: "unauthenticated" };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "failed" };

  const userId = await ensureUserRowId(viewer);
  if (userId === null) return { ok: false, error: "failed" };

  return { ok: true, userId, supabase };
}

/**
 * The list as it now stands, keyed by the *Clerk* id.
 *
 * `getAddressesForUser()` joins through `"User"` on `clerkId` rather than
 * taking the row id, which is what keeps a caller from ever naming that row —
 * so the read path stays the one the panels use, unchanged.
 */
async function currentList(): Promise<readonly SavedAddress[]> {
  const viewer = await getViewer();
  return viewer === null ? [] : getAddressesForUser(viewer.id);
}

/**
 * Add an address, or edit one.
 *
 * `id` present is an edit, and the update is scoped to the owner as well as the
 * row: an id belonging to another customer updates nothing, and the reply is
 * the same "failed" a missing row gets. Nothing here tells the caller whether
 * the id existed.
 *
 * The first address a customer saves becomes the default whatever the form
 * said. A book of one with nothing marked is a checkout with nothing to offer.
 */
export async function saveAddress(input: unknown): Promise<AddressResult> {
  const parsed = addressInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation",
      fieldErrors: addressFieldErrors(parsed.error),
    };
  }

  const ctx = await context();
  if (!ctx.ok) return ctx;

  const { supabase, userId } = ctx;
  const { id, isDefault, ...fields } = parsed.data;

  const { count, error: countError } = await supabase
    .from("Address")
    .select("id", { count: "exact", head: true })
    .eq("userId", userId);

  if (countError) {
    console.error(`[addresses] count failed: ${countError.message}`);
    return { ok: false, error: "failed" };
  }

  const isFirst = (count ?? 0) === 0;
  const wantsDefault = isDefault || isFirst;

  // Cleared before anything is set, so the partial unique index never sees two.
  if (wantsDefault) {
    const cleared = await clearDefault(supabase, userId, id);
    if (!cleared) return { ok: false, error: "failed" };
  }

  if (id === undefined) {
    const { error } = await supabase
      .from("Address")
      .insert({ ...fields, userId, isDefault: wantsDefault });

    if (error) {
      console.error(`[addresses] insert failed: ${error.message}`);
      return { ok: false, error: "failed" };
    }
  } else {
    const { data, error } = await supabase
      .from("Address")
      .update({ ...fields, isDefault: wantsDefault, updatedAt: new Date().toISOString() })
      .eq("id", id)
      // The access control. Never remove it.
      .eq("userId", userId)
      .select("id");

    if (error) {
      console.error(`[addresses] update failed: ${error.message}`);
      return { ok: false, error: "failed" };
    }

    // Zero rows means the id was not this customer's. Reported as a plain
    // failure: the reply must not confirm that somebody else's id exists.
    if ((data?.length ?? 0) === 0) return { ok: false, error: "failed" };
  }

  return { ok: true, addresses: await currentList() };
}

/**
 * Remove one address.
 *
 * Removing the default promotes the oldest remaining address rather than
 * leaving the book without one.
 */
export async function deleteAddress(input: unknown): Promise<AddressResult> {
  const parsed = addressIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const ctx = await context();
  if (!ctx.ok) return ctx;

  const { supabase, userId } = ctx;

  const { data, error } = await supabase
    .from("Address")
    .delete()
    .eq("id", parsed.data.id)
    .eq("userId", userId)
    .select("isDefault");

  if (error) {
    console.error(`[addresses] delete failed: ${error.message}`);
    return { ok: false, error: "failed" };
  }

  if ((data?.length ?? 0) === 0) return { ok: false, error: "failed" };

  if (data?.[0]?.isDefault === true) {
    const { data: survivors, error: survivorError } = await supabase
      .from("Address")
      .select("id")
      .eq("userId", userId)
      .order("createdAt", { ascending: true })
      .limit(1);

    if (survivorError) {
      console.error(`[addresses] promote failed: ${survivorError.message}`);
    } else if (survivors && survivors.length > 0) {
      await supabase
        .from("Address")
        .update({ isDefault: true })
        .eq("id", survivors[0].id)
        .eq("userId", userId);
    }
  }

  return { ok: true, addresses: await currentList() };
}

/** Promote one address to default, clearing whichever held it before. */
export async function setDefaultAddress(input: unknown): Promise<AddressResult> {
  const parsed = addressIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const ctx = await context();
  if (!ctx.ok) return ctx;

  const { supabase, userId } = ctx;
  const { id } = parsed.data;

  if (!(await clearDefault(supabase, userId, id))) {
    return { ok: false, error: "failed" };
  }

  const { data, error } = await supabase
    .from("Address")
    .update({ isDefault: true })
    .eq("id", id)
    .eq("userId", userId)
    .select("id");

  if (error) {
    console.error(`[addresses] setDefault failed: ${error.message}`);
    return { ok: false, error: "failed" };
  }

  if ((data?.length ?? 0) === 0) return { ok: false, error: "failed" };

  return { ok: true, addresses: await currentList() };
}

/**
 * Take the default off whichever address holds it.
 *
 * `except` is the row about to receive it — skipped so that re-saving the
 * customer's existing default does not clear and re-set the same row, which
 * would leave a window with no default at all.
 */
async function clearDefault(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  except: string | undefined,
): Promise<boolean> {
  let query = supabase
    .from("Address")
    .update({ isDefault: false })
    .eq("userId", userId)
    .eq("isDefault", true);

  if (except !== undefined) query = query.neq("id", except);

  const { error } = await query;

  if (error) {
    console.error(`[addresses] clearDefault failed: ${error.message}`);
    return false;
  }

  return true;
}
