-- ONE-TIME REVIEW SCRIPT — NOT RUN BY npm run db:migrate.
--
-- This script is intentionally preview-only as written. Populate the explicit
-- mapping below using Clerk records whose primary email is verified. Do not
-- infer verification from public."User".email or from the order itself.
--
-- First run the preview SELECT and review the proposed matches. To apply later,
-- separately uncomment the marked transaction and UPDATE, replace the sample
-- mapping with the reviewed verified Clerk identities, and execute only after
-- explicit approval. The UPDATE can only attach orders that are still unowned.

with verified_accounts(clerk_user_id, verified_email) as (
  values
    -- Replace with verified Clerk identity records, for example:
    -- ('user_abc123', 'customer@example.com')
    (null::text, null::text)
), normalized_accounts as (
  select btrim(clerk_user_id) as clerk_user_id,
         lower(btrim(verified_email)) as verified_email
    from verified_accounts
   where nullif(btrim(clerk_user_id), '') is not null
     and nullif(btrim(verified_email), '') is not null
     and lower(btrim(verified_email)) in (
       select lower(btrim(verified_email))
         from verified_accounts
        where nullif(btrim(clerk_user_id), '') is not null
          and nullif(btrim(verified_email), '') is not null
        group by lower(btrim(verified_email))
       having count(distinct btrim(clerk_user_id)) = 1
     )
), proposed as (
  select o.id, o."orderNumber", o."customerEmail", a.clerk_user_id
    from public."Order" o
    join normalized_accounts a
      on lower(btrim(o."customerEmail")) = a.verified_email
   where o."clerkUserId" is null
     and o.channel = 'ONLINE'
)
select id, "orderNumber", "customerEmail", clerk_user_id
  from proposed
 order by "orderNumber";

-- APPLY SECTION — intentionally commented out; do not execute without a
-- separate approval. Use the same verified_accounts mapping as the preview.
-- begin;
-- with verified_accounts(clerk_user_id, verified_email) as (
--   values
--     ('user_abc123', 'customer@example.com')
-- ), normalized_accounts as (
--   select btrim(clerk_user_id) as clerk_user_id,
--          lower(btrim(verified_email)) as verified_email
--     from verified_accounts
--    where nullif(btrim(clerk_user_id), '') is not null
--      and nullif(btrim(verified_email), '') is not null
--      and lower(btrim(verified_email)) in (
--        select lower(btrim(verified_email))
--          from verified_accounts
--         where nullif(btrim(clerk_user_id), '') is not null
--           and nullif(btrim(verified_email), '') is not null
--         group by lower(btrim(verified_email))
--        having count(distinct btrim(clerk_user_id)) = 1
--      )
-- )
-- update public."Order" o
--    set "clerkUserId" = a.clerk_user_id,
--        "updatedAt" = now()
--   from normalized_accounts a
--  where o."clerkUserId" is null
--    and o.channel = 'ONLINE'
--    and lower(btrim(o."customerEmail")) = a.verified_email;
-- commit;
