-- KHEM — welcoming a new account, exactly once, with a code that works.
--
-- Applied by `npm run db:migrate` after `0029_discount_preview.sql`. It reads
-- `discounts` and `discount_grants` from `0028`, and `"User"` from `0024`.
--
-- ── The two things that must not go wrong ───────────────────
--
-- **Nobody is welcomed twice.** Clerk retries a webhook until it gets a 2xx and
-- may deliver the same `user.created` after one, so "check whether we have sent
-- it, then send it" has a gap wide enough to put two letters in an inbox.
-- `claim_welcome()` therefore *claims* the right to send with a conditional
-- update: whoever gets a row back may write; everybody else is told the letter
-- is already spoken for. That is the same mechanism `soft_delete_clerk_user()`
-- in 0024 uses, and it is here for the same reason.
--
-- **The code in the letter is real.** §7.2 of the plan is blunt about this: the
-- system "must not simply hard-code a voucher into the email template". So the
-- grant is written *in this function*, in the same transaction as the claim, and
-- the code returned is the code that was written. There is no arrangement of
-- failures that produces a letter naming an entitlement the database does not
-- hold — either both happened or neither did.
--
-- ── The welcome offer is a row, not an environment variable ─
--
-- `discounts."isWelcome"` marks it, and a partial unique index allows exactly
-- one. `0003_directory.sql` states the doctrine: merchandising "belongs in the
-- database rather than in a constant a marketer cannot reach". The house picks
-- the welcome offer in the discount editor and no deploy is involved.
--
-- **The letter does not depend on it.** No flagged campaign, an inactive one, or
-- one outside its window all produce a welcome with no voucher block rather than
-- no welcome. A house that stops greeting people because a campaign lapsed is
-- worse than one that greets them and offers nothing.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Unchanged from 0024/0028: RLS on, no policy, nothing granted to the public
-- roles, `execute` revoked. The caller is the Clerk webhook holding the secret
-- key, and the only thing it may name is a Clerk id it just verified a signature
-- over.

-- ── "User"."welcomedAt" ─────────────────────────────────────
--
-- When the welcome letter was claimed. Null means never.
--
-- The `do` block is load-bearing and not ceremony. `npm run db:migrate` applies
-- every file on every run, so an unguarded `update … where "welcomedAt" is null`
-- would stamp every account created *since* the first run and silently suppress
-- their welcomes. Adding the column and backfilling it in the same branch means
-- the backfill happens exactly once, on the run that introduces the column.
--
-- The backfill itself is the important half: every account that existed before
-- this feature has already been through sign-up without a letter, and must not
-- receive one now because a column appeared.

do $$
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'User'
       and column_name = 'welcomedAt'
  ) then
    alter table public."User" add column "welcomedAt" timestamptz;

    -- Everyone who already had an account is considered welcomed.
    update public."User" set "welcomedAt" = coalesce("createdAt", now());
  end if;
end $$;

-- ── discounts."isWelcome" ───────────────────────────────────

alter table public.discounts
  add column if not exists "isWelcome" boolean not null default false;

-- At most one welcome offer, enforced rather than remembered. A partial index,
-- because "many rows may be false" and "one row may be true" is exactly what a
-- partial unique index says.
create unique index if not exists discount_welcome_idx
  on public.discounts ("isWelcome")
  where "isWelcome";

-- **Moving the flag is one action, not two.**
--
-- Ticking a second campaign as the welcome offer must *un*tick the first, and
-- the unique index above would otherwise refuse the write and leave the desk to
-- work out why. A trigger does it in the same statement, which also means no
-- future writer — a script, a backfill, a second admin action — can set the flag
-- and forget to clear the old one.
--
-- Clearing runs before the row lands, so the index never sees two.

create or replace function public.enforce_single_welcome_discount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new."isWelcome" then
    update public.discounts
       set "isWelcome" = false,
           "updatedAt" = now()
     where "isWelcome"
       and id is distinct from new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists discount_single_welcome on public.discounts;

create trigger discount_single_welcome
  before insert or update of "isWelcome" on public.discounts
  for each row
  when (new."isWelcome")
  execute function public.enforce_single_welcome_discount();

-- ── claim_welcome ───────────────────────────────────────────
--
-- Claims the letter and issues the voucher, or reports that somebody else got
-- there first.
--
-- Returns `{ claimed, email, firstName, code, expiresAt }`. When `claimed` is
-- false nothing else is populated and the caller sends nothing.
--
-- `code` is null when no welcome offer is configured — a letter with no voucher
-- block, not a failure.

create or replace function public.claim_welcome(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clerk_id text := nullif(payload->>'clerkId', '');
  v_user     record;
  v_discount record;
  v_expires  timestamptz;
  v_code     text;
begin
  if v_clerk_id is null then
    return jsonb_build_object('claimed', false);
  end if;

  /*
   * The claim. `"welcomedAt" is null` in the predicate is the whole of the
   * duplicate protection: a second caller updates zero rows and returns
   * empty-handed, whether it arrived a second later or a week later.
   *
   * A soft-deleted account is not welcomed — `deletedAt` is set by
   * `soft_delete_clerk_user()`, and writing to somebody who has closed their
   * account is precisely what that column exists to prevent.
   */
  update public."User"
     set "welcomedAt" = now(),
         "updatedAt"  = now()
   where "clerkId" = v_clerk_id
     and "welcomedAt" is null
     and "deletedAt" is null
  returning email, "firstName" into v_user;

  if not found then
    return jsonb_build_object('claimed', false);
  end if;

  -- ── The welcome offer, if the house has one ─────────────
  --
  -- Judged the same way `resolve_discount()` judges any code: active, started,
  -- not ended. A campaign that would be refused at checkout must not be printed
  -- in a letter promising it.
  select * into v_discount
    from public.discounts
   where "isWelcome"
     and "isActive"
     and ("startsAt" is null or "startsAt" <= now())
     and ("endsAt" is null or "endsAt" > now());

  if found then
    /*
     * Sixty days, matching the window `0028`'s `discount_grants` header names
     * for the welcome offer. Capped at the campaign's own end date where it has
     * one — a grant outliving its campaign is a code that stops working with no
     * explanation the customer can see.
     */
    v_expires := least(
      now() + interval '60 days',
      coalesce(v_discount."endsAt", now() + interval '60 days')
    );

    /*
     * `do nothing` rather than an error: a retry after a released claim (the
     * webhook releases when the letter could not be sent) must reuse the grant
     * it already wrote rather than fail on the unique index. The select below
     * reads back whichever row now exists, so the letter names the real one.
     */
    insert into public.discount_grants
      ("discountId", email, "clerkUserId", "expiresAt")
    values (v_discount.id, lower(v_user.email), v_clerk_id, v_expires)
    on conflict ("discountId", email) do nothing;

    -- Only name the code if the grant is actually spendable. One already used
    -- — an address invited, welcomed, deleted and re-registered — is not a
    -- privilege to advertise a second time.
    if exists (
      select 1
        from public.discount_grants g
       where g."discountId" = v_discount.id
         and g.email = lower(v_user.email)
         and g."usedAt" is null
    ) then
      v_code := v_discount.code;
    end if;
  end if;

  return jsonb_build_object(
    'claimed', true,
    'email', v_user.email,
    'firstName', v_user."firstName",
    'code', v_code,
    'expiresAt', v_expires
  );
end;
$$;

-- ── release_welcome ─────────────────────────────────────────
--
-- Hands the claim back, so a letter that could not be sent can be sent later.
--
-- Without this, one Resend outage would cost a customer their welcome
-- permanently: the claim would stand, and every retry would be told the letter
-- was already spoken for. The grant is deliberately **not** withdrawn — it is a
-- real entitlement now, it shows in the customer's account, and taking it back
-- because an email bounced would be the wrong half to undo.
--
-- Narrow by construction: it only clears a stamp, and only for an account that
-- has one.

create or replace function public.release_welcome(clerk_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released boolean := false;
begin
  update public."User"
     set "welcomedAt" = null,
         "updatedAt"  = now()
   where "clerkId" = clerk_id
     and "welcomedAt" is not null
  returning true into v_released;

  return coalesce(v_released, false);
end;
$$;

-- ── Privileges ──────────────────────────────────────────────

revoke all on function public.claim_welcome(jsonb)   from public, anon, authenticated;
revoke all on function public.enforce_single_welcome_discount()
  from public, anon, authenticated;
revoke all on function public.release_welcome(text)  from public, anon, authenticated;
