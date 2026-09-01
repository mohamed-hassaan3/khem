# Password policy — where it lives, and why not in this repository

## The short answer

KHEM's password rules are **Clerk Dashboard configuration**. Nothing in this
codebase validates, enforces, or can relax them, and nothing in it should try.

## Why there is no code to change

`/signin` and `/signup` mount Clerk's prebuilt `<SignIn>` and `<SignUp>`
components (`src/components/auth/SignInForm.tsx`, `SignUpForm.tsx`). The
password field, its validation, its error strings and the "compromised password"
check are all inside Clerk's component and are driven by the instance settings —
not by props, and not by the appearance object in `src/lib/clerk-appearance.ts`,
which is presentation only.

A search of the repository for password validation returns nothing: there is no
Zod schema, no server action, and no client rule that touches a password. That
is deliberate and is the reason the sign-up form cannot currently accept a
password Clerk would then reject.

The alternative — hand-rolling the flow on `useSignUp` — would mean owning
password reset, MFA, OAuth callbacks, bot protection and every error string in
two languages, to gain control of one rule. That trade is refused in
`clerk-appearance.ts` for the same reason it is refused here.

## Relaxing the policy

Clerk Dashboard → **Configure** → **User & Authentication** → **Password**, for
the instance the deployment's `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` belongs to
(there is a separate development and production instance — changing one does not
change the other).

Recommended settings for a boutique storefront:

| Setting | Value | Why |
| :--- | :--- | :--- |
| Minimum length | **8** | The floor NIST SP 800-63B recommends. Below 8 is not worth the support cost. |
| Require uppercase / lowercase / number / special character | **off** | Composition rules push people toward `Password1!` and toward reuse. They are the single largest source of abandoned sign-ups and are explicitly discouraged by NIST 800-63B §5.1.1.2. |
| Reject compromised passwords (HIBP) | **on** | Keep it. This is the check that actually prevents account takeover, and it costs an honest visitor nothing — it only fires on a password already known to be in a breach corpus. |
| Reject passwords found in the user's own data | **on** | Free, and stops the obvious ones. |

Net effect: a visitor may use any eight characters they like, provided that
exact string is not already in a public breach.

## The invariant

**Do not add a client-side password rule to this repository.** While `<SignUp>`
owns the form, any rule written here is a second, unenforced policy that can
only ever disagree with the real one — the failure mode the brief names
explicitly (a UI that accepts a password Clerk rejects, or the reverse). If the
policy ever needs to be expressed in code, the Dashboard setting is what has to
change with it, in the same commit, and this document is where that is recorded.
