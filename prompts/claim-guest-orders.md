# Claim Guest Orders for Verified Clerk Accounts

## Goal

Make previously guest-placed online orders visible to the customer who later signs in with the same **verified** email address, while preserving account ownership and the current account dashboard design. Logged-in checkout must continue to stamp the authenticated Clerk user ID onto the order at creation.

## Skills read

- `.agents/skills/clerk/SKILL.md`
- `.agents/skills/supabase/SKILL.md`

## Existing code inspected

- `src/actions/checkout.ts`: obtains `clerkUserId` from `getUserId()` and passes it to `place_order()`.
- `supabase/sql/0015_orders.sql`: stores `customerEmail` and nullable `clerkUserId`.
- `src/app/api/webhooks/stripe/route.ts`: settles Stripe payment without changing order ownership.
- `src/app/api/webhooks/clerk/route.ts`: calls `sync_clerk_user()` for user-created/updated events; primary email parsing currently does not check verification status.
- `supabase/sql/0059_rewards.sql`: current `sync_clerk_user()` implementation.
- `src/services/account.ts`: `getOrdersForUser()` filters only on exact `clerkUserId`; `ensureUserRowId()` is currently a write-time fallback for account address operations.
- `src/app/[locale]/account/page.tsx` and `src/app/[locale]/account/orders/page.tsx`: dashboard overview and order history load orders directly and have no claim step.
- `supabase/sql/0024_customers.sql`: customer rows have a soft Clerk link (`User.clerkId`) and a live lower-email unique index; app-level records are stored here.

## Confirmed findings and history

- Guest checkout writes an empty Clerk ID which SQL converts to `NULL`, while retaining checkout `customerEmail`.
- Signed-in checkout already passes the server-observed Clerk ID. Do not weaken this or accept a user ID from checkout input.
- Dashboard reads only rows with `Order.clerkUserId = Clerk user ID`.
- The Stripe webhook never links orders.
- Clerk sync creates or updates a `User` row, but does not claim orders. The webhook’s existing email parsing accepts an unverified email; it must not be reused as proof of ownership.
- Email case and surrounding whitespace are not normalized consistently across the stored order email and current user sync. Different checkout and account emails cannot safely match and must remain unlinked.
- History reviewed: `7df4706` changed checkout timing but not owner assignment; `ac12f56` added welcome handling without order linking. Histories for checkout, Clerk webhook, account service and account overview show no later ownership-claim fix.

## Decisions and assumptions

- Only a Clerk primary email whose Clerk verification state is explicitly `verified` may drive claiming. If primary email is missing or unverified, do not fall back to an unverified secondary address and do not claim.
- Normalize comparison emails as `lower(btrim(email))` on both sides. Do not apply provider-specific transformations such as removing dots or plus tags.
- Never change an order with a non-null `clerkUserId` that differs from the current Clerk user.
- Make the claim atomic and idempotent in a restricted Supabase database function (or an equivalent single safe DB operation). Keep the service-role credential server-only. The function may claim only unowned matching orders and customer rows that are safe to associate; it must not silently transfer a live customer row already owned by a different Clerk identity. Handle an existing live-email uniqueness conflict explicitly and fail closed.
- Run claiming after successful Clerk sync on a verified `user.created` event, and as a fallback on authenticated account overview and order-history loads. The fallback obtains verification only from server-side Clerk user data. Keep account UI unchanged.
- Do not add schema columns unless inspection shows the current function/API cannot implement these constraints. If a SQL function or migration is added, follow the repository’s migration and PostgREST-cache instructions.
- Add a standalone, review-only one-time SQL script for existing rows. It must never be executed during implementation. Because database rows alone do not prove email verification, the script must require an explicit verified Clerk identity mapping (Clerk user ID plus verified email) rather than infer verification from `User.email` alone. Include a dry-run preview and guard so it cannot update existing non-null order owners.

## Files likely to change

- `src/app/api/webhooks/clerk/route.ts`
- `src/lib/auth.ts` or a narrowly scoped server-side Clerk identity helper
- `src/services/account.ts`
- `src/app/[locale]/account/page.tsx`
- `src/app/[locale]/account/orders/page.tsx`
- `src/actions/checkout.ts` only if verification confirms current logged-in checkout stamping needs correction
- A new Supabase SQL migration/function file and the project’s migration registration, only if required by the chosen atomic claim implementation
- A new standalone SQL preview/apply script under an appropriately documented `supabase/` location; create it but never run it

## Implementation requirements

1. Read the Clerk email-address types/docs available in the installed package and confirm the verified-status field used by webhook payloads and server-side `currentUser()`.
2. Extend the webhook parsing narrowly to expose whether the primary email is explicitly verified. Do not use `unsafeMetadata`, request input, or stored `User.email` as verification evidence.
3. Ensure customer sync can safely handle an existing customer row with the same normalized verified email without overwriting a different live Clerk owner. Preserve current marketing-consent and welcome behavior.
4. Implement one server-only idempotent claim service. Pass the authenticated Clerk ID and verified, normalized email from trusted server-side Clerk data. Claim only matching online guest orders whose owner is null; preserve all other owners. Associate only eligible customer records under the same verified-email and no-owner-transfer rules.
5. Invoke the claim service after successful sync in the verified Clerk `user.created` path and before dashboard order reads on both account overview and order-history pages. Errors must be logged without leaking emails or private order data; account reads must remain safely scoped by Clerk ID.
6. Keep checkout identity sourced only from the Clerk server session. Confirm that the existing `getUserId()` flow remains intact for logged-in checkout.
7. Create the one-time SQL script as a review artifact only. Include (a) a preview query, (b) an explicit input mapping of verified Clerk IDs/emails, (c) transaction boundaries, (d) `WHERE clerkUserId IS NULL`, and (e) a clear commented apply section. Do not run it or any SQL that relinks production/existing data.
8. Do not change dashboard layout, copy, styling, or account components.

## Security requirements

- Only Clerk’s explicit verified primary email can authorize email-based linking.
- Account fallback must use server-side Clerk data and never client-supplied email or user ID.
- The linking function must not be executable by `anon` or `authenticated`; grant only the server’s privileged path as required by the existing Supabase patterns.
- Atomic updates must retain `clerkUserId IS NULL` conditions so repeated/racing claims cannot overwrite an existing owner.
- Treat email matching as case-insensitive and whitespace-trimmed only. A different email means no claim.
- Do not log raw email, order number, address, phone, or order contents in the new flow.

## Acceptance criteria

- A verified user with email `X` claims previously unowned orders whose stored checkout email normalizes to `X`.
- An unverified email cannot claim orders, whether the claim path is the Clerk webhook or account fallback.
- A different account/email sees none of those orders.
- Orders already linked to any Clerk user remain owned by that user.
- Repeated webhook delivery, repeated dashboard load, and concurrent claim attempts are safe and idempotent.
- Case/outer-whitespace differences match; a genuinely different address does not.
- Logged-in checkout stores the current Clerk user ID from the server session.
- Existing customer sync, consent handling, welcome handling, and dashboard design remain intact.
- The standalone SQL file is present and reviewed in the final response, but has not been run.

## Checks to run after approval

- Run the repository’s relevant typecheck and lint commands.
- Run focused existing tests or add focused tests for verified/unverified, matching/different emails, existing ownership, and idempotency as appropriate.
- Do not apply the standalone one-time SQL script. Do not run a database migration against any shared/production database.
- Report check results and explicitly state the SQL script was not executed.

## Exact manual test steps

1. As a guest, place and successfully pay for an order using email `X`; note the order number.
2. Create a Clerk account using the same email `X` and complete Clerk email verification.
3. Open the account dashboard and order history; confirm the order appears once and its details are correct.
4. Reload both pages and redeliver/replay the Clerk user-created webhook in a safe local/test environment; confirm there is still one order and no ownership changes.
5. Create/sign in to a second account with a different verified email `Y`; confirm the `X` order is absent from both overview and order history.
6. In a safe test environment, confirm an account with an unverified matching email cannot claim the order; after verification, confirm the verified claim succeeds.
7. Place an order while signed in and confirm it is attached to that account immediately.
8. Inspect and review the one-time SQL preview output, but do not execute its apply section without separate explicit approval.
