# KHEM HOUSE — CUSTOMER EXPERIENCE & ENGAGEMENT PLAN

## Purpose

This document defines the next implementation phase for the KHEM House web application after completing:

* Supabase database setup
* `AGENTS.md`
* Authentication integration
* Admin dashboard
* Voucher and customer credit database foundation

The next phase focuses on the **customer-facing experience**, customer engagement, emails, vouchers, credits, checkout, and improvements to the admin experience.

---

# 1. Core Experience Vision

KHEM should not feel like a standard e-commerce website.

The digital experience should feel like an extension of **KHEM House**.

The customer journey should be built around four pillars:

## 1. Discover

Customers discover:

* Collections
* Fragrances
* Ingredients
* Heritage
* Craftsmanship
* Brand stories

## 2. Belong

Customers become part of KHEM House through:

* Personal account
* Profile
* Preferences
* Order history

## 3. Privileges

Customers receive exclusive benefits through:

* Vouchers
* Customer credits
* Private offers
* Welcome discounts
* Exclusive campaigns

## 4. Experience

Customers receive a complete premium service experience through:

* Orders
* Notifications
* Email communication
* Delivery updates
* Customer support

---

# 2. Implementation Principles

All new functionality must follow these principles:

* Premium and minimal user experience.
* KHEM branding should be visible instead of generic third-party UI where possible.
* Customer benefits must be easy to understand.
* Vouchers and credits must be transparent.
* The system must prevent accidental loss of admin work.
* Notifications must be organized and not intrusive.
* Marketing communication must remain separate from transactional communication.
* Do not introduce breaking changes to existing authentication, database, or admin functionality.
* Reuse the existing database structure and policies where appropriate.
* Follow the existing repository architecture and `AGENTS.md`.

---

# 3. Customer Account Experience

## **3.1 Minimal KHEM Account Menu**

The current generic profile/account experience should be customized for KHEM.

The profile icon in the top-right corner should open a minimal KHEM account menu.

The menu should not primarily direct users to the generic **Manage Account** screen.

Keep the profile menu simple and focused.

For customers, it should contain only:

* Dashboard
* Sign Out

Example:

[ User Name ]

[ Email Address ]

----------------

Dashboard

----------------

Sign Out

Clicking **Dashboard** should take the customer to their dedicated KHEM Customer Dashboard.

All account management and customer features should be organized inside the Customer Dashboard rather than overcrowding the profile dropdown menu.

---

## **3.2 Customer Dashboard**

The Customer Dashboard should become the central area for managing the customer's relationship with KHEM House.

The dashboard can contain its own navigation for:

* Overview
* Profile
* My Orders
* My Addresses
* My Vouchers & Credits
* Notifications
* Preferences

The exact navigation structure should remain flexible as features are implemented.

The goal is to keep the top-right profile menu minimal while providing a complete and organized experience inside the dedicated Customer Dashboard.

The Customer Dashboard should feel like a private area within KHEM House rather than a generic account settings page.

---

## 3.3 Admin Account Menu

For administrators, provide access to:

* Admin Profile
* Admin Dashboard
* Store Management
* Notifications
* Logout

The existing role and authorization system must remain protected.

---

## 3.4 Remove Clerk Development Branding

Remove the unnecessary development-related UI currently visible in the profile card/menu, including:

* `Secured by`
* Clerk logo where it is only visible as development branding
* `Development mode`

The production KHEM experience should feel integrated and branded.

Do not remove Clerk functionality or security. Only remove or hide unnecessary third-party development UI from the customer-facing experience.

---

# 4. My Vouchers & Credits

Create a dedicated customer area:

## My Vouchers & Credits

This area should clearly separate:

1. KHEM Credits
2. Available Vouchers
3. Voucher History or Status
4. Credit Transaction History

---

## 4.1 KHEM Credit Balance

Display the customer's available credit clearly.

Example:

```text
KHEM Credit

EGP 250
Available to use during checkout.
```

The implementation must use the existing `customer_credits` and `credit_transactions` foundation where applicable.

Do not duplicate financial data unnecessarily.

---

## 4.2 Credit Transaction History

Customers should understand where their credit came from and how it was used.

Each transaction should show:

* Date
* Description
* Type
* Amount

Example:

| Date   | Description    |   Amount |
| ------ | -------------- | -------: |
| Aug 20 | Welcome Credit | +250 EGP |
| Aug 25 | Order #1024    | -100 EGP |
| Aug 26 | Refund Credit  | +300 EGP |

The history should clearly distinguish between:

* Credit added
* Credit used
* Refund credit
* Promotional credit
* Manual admin adjustment

---

## 4.3 Available Vouchers

Each voucher should display:

* Voucher code
* Discount type
* Discount amount or percentage
* Minimum order requirement, if applicable
* Expiration date
* Status

Example:

```text
WELCOME15

15% OFF

Minimum order: EGP 1,000
Expires: December 31, 2026

[ Copy Code ]
```

---

## 4.4 Voucher Status

Clearly communicate voucher status.

Possible states:

* Available
* Applied
* Used
* Expired
* Not yet active
* Unavailable

The UI should not confuse customers by showing invalid vouchers as active.

---

## 4.5 Copy Voucher Code

Provide a simple:

```text
[ Copy Code ]
```

button.

After copying, provide clear feedback:

```text
Voucher code copied.
```

---

# 5. Checkout Voucher Experience

The customer must be able to validate and apply a voucher before completing payment.

---

## 5.1 Voucher Field

Add a dedicated voucher section in checkout.

Example:

```text
Have a voucher code?

[ ENTER VOUCHER CODE              ]

[ Apply ]
```

---

## 5.2 Voucher Validation

When the customer clicks `Apply`, validate the voucher before the payment process.

Validation should check:

* Voucher exists.
* Voucher is active.
* Voucher has not expired.
* Voucher usage limits have not been exceeded.
* Customer is eligible, if the voucher is customer-specific.
* Minimum order requirements are met.
* Voucher is not already used when it is single-use.
* Voucher can be combined with other discounts only if allowed.

---

## 5.3 Successful Application

After a successful validation:

```text
✓ WELCOME15 applied

You saved EGP 270

[ Remove ]
```

The order summary must update immediately.

---

## 5.4 Invalid Voucher

Display a useful message.

Examples:

```text
This voucher code is invalid.
```

```text
This voucher has expired.
```

```text
This voucher requires a minimum order value of EGP 1,000.
```

Avoid vague errors such as:

```text
Something went wrong.
```

when the exact reason can be safely shown.

---

## 5.5 View My Available Vouchers

Add a button or link:

```text
View My Available Vouchers
```

Authenticated customers should be able to see eligible vouchers associated with their account and select one directly.

This is preferred over requiring customers to remember voucher codes.

---

# 6. Checkout Credit Experience

Customers should be able to see and understand their available KHEM Credit during checkout.

Example:

```text
KHEM Credit Available

EGP 250

[ Apply Credit ]
```

The implementation must clearly define whether:

* All available credit is applied automatically.
* The customer chooses the amount.
* Credit can be combined with vouchers.
* Credit can be combined with other promotions.

These rules should be centralized and consistent.

---

## 6.1 Order Summary

The checkout summary should clearly display all adjustments.

Example:

```text
Subtotal                 EGP 2,000

Discount                 - EGP 300

KHEM Credit              - EGP 200

Shipping                 EGP 50

--------------------------------

Total                    EGP 1,550
```

Totals must update immediately when:

* Voucher is applied.
* Voucher is removed.
* Credit is applied.
* Credit is removed.
* Product quantity changes.
* Cart contents change.

---

# 7. Welcome Email System

Create a transactional welcome email flow.

---

## 7.1 Welcome Email Trigger

The welcome email should be sent after:

* A new customer successfully registers and becomes active.
* An invited customer successfully accepts an invitation and activates their account.

Do not send duplicate welcome emails.

---

## 7.2 Welcome Voucher

The welcome email may include a voucher or customer benefit.

The system must not simply hard-code a voucher into the email template.

Recommended flow:

1. Customer account is created and activated.
2. System creates or assigns the eligible welcome voucher.
3. Voucher is stored in the database.
4. Voucher is associated with the customer when appropriate.
5. The valid voucher code is passed to the email.
6. Welcome email is sent.

This ensures that the code shown in the email is actually valid.

---

## 7.3 Welcome Email Content

The email should be premium, minimal, and aligned with KHEM House.

Suggested structure:

1. KHEM logo
2. Welcome message
3. Short introduction to KHEM House
4. Private welcome benefit
5. Voucher code
6. Clear call to action

Example concept:

```text
Welcome to KHEM House.

A world where heritage, craftsmanship,
and fragrance meet.

As a welcome to our House,
we are pleased to offer you a private privilege.

YOUR WELCOME CODE

WELCOME15

15% OFF your first order.

[ EXPLORE KHEM HOUSE ]
```

Final copy and visual design can be refined separately.

---

# 8. Invited User Experience

When an administrator invites a user:

1. The user receives an invitation email.
2. The user accepts the invitation.
3. The user completes account activation.
4. The system identifies the account as active.
5. The welcome email flow is triggered if applicable.

Example invitation CTA:

```text
[ ACCEPT INVITATION ]
```

---

## 8.1 Avoid Duplicate Emails

The system should avoid sending unnecessary emails.

Recommended flow:

### Normal Registration

1. Customer registers.
2. Customer completes verification if required.
3. Account becomes active.
4. Welcome benefit is assigned.
5. Welcome email is sent.

### Admin Invitation

1. Invitation email is sent.
2. User accepts the invitation.
3. Account becomes active.
4. Welcome benefit is assigned if applicable.
5. Welcome email is sent.

The invitation email and welcome email have different purposes and should remain separate.

---

# 9. Email Architecture

Separate email functionality into two categories.

---

## 9.1 Transactional Emails

Transactional emails are directly related to a customer's account or activity.

Examples:

* Welcome email
* Account invitation
* Account verification
* Password reset
* Order confirmation
* Payment confirmation
* Order shipped
* Delivery update
* Refund confirmation

Transactional emails should not depend on marketing subscription preferences where legally and technically appropriate.

---

## 9.2 Marketing Emails

Marketing emails include:

* Discounts
* New arrivals
* New collections
* Seasonal campaigns
* Private offers
* Brand announcements

Marketing emails should only be sent according to the customer's marketing preferences and applicable requirements.

---

# 10. Marketing Subscription Preferences

Add a marketing preference option during appropriate customer flows.

Example:

```text
[ ] I would like to receive news,
private offers and updates from KHEM House.
```

Customers should also be able to manage their marketing preferences from their account.

The system should support unsubscribing from marketing emails.

---

# 11. Marketing Email Campaign System

Create an admin-managed campaign system.

Campaign types should include:

* New Arrival
* Discount
* New Collection
* Exclusive Offer
* Seasonal Campaign
* Custom Campaign

---

## 11.1 Campaign Fields

The admin should be able to configure:

* Campaign name
* Campaign type
* Email subject
* Preview text
* Email content
* Hero image
* CTA text
* CTA destination
* Voucher code, if applicable
* Target audience
* Send date or scheduling options

---

## 11.2 Example Campaign

```text
Campaign Name:
NOIR Private Access

Campaign Type:
Exclusive Offer

Subject:
An Exclusive Privilege from KHEM NOIR

Voucher:
NOIR15

Discount:
15%

CTA:
Discover the Collection
```

---

# 12. Admin Unsaved Changes Protection

Protect administrators from accidentally losing work.

The system should detect when an administrator modifies a form without saving it.

---

## 12.1 Navigation Warning

If the administrator attempts to leave a page with unsaved changes, display a confirmation dialog.

Recommended dialog:

```text
Unsaved Changes

You have unsaved changes.

Would you like to save your changes before leaving?

[ Cancel ]

[ Discard Changes ]

[ Save Changes ]
```

---

## 12.2 Button Behavior

### Cancel

Remain on the current page.

### Discard Changes

Leave the page without saving changes.

### Save Changes

Save changes first, then continue with the requested navigation.

---

## 12.3 Browser-Level Protection

Where technically appropriate, protect against accidental:

* Browser refresh
* Browser tab closing
* Navigation away from the application

Do not create unnecessary warnings when there are no changes.

---

# 13. Admin Notifications

The existing notification implementation should be reviewed.

Notifications should be separated into:

1. Temporary feedback
2. Persistent notification center

---

# 14. Temporary Toast Notifications

Temporary feedback notifications should be used for actions such as:

```text
Product saved successfully.
```

```text
Voucher created successfully.
```

```text
Campaign scheduled successfully.
```

These notifications should:

* Appear temporarily.
* Not permanently block content.
* Automatically disappear.
* Provide accessible feedback.

Recommended position:

* Top-right, or
* Bottom-right

The exact location should remain consistent across the dashboard.

---

# 15. Persistent Admin Notification Center

Create a notification bell in the admin dashboard header.

Example:

```text
🔔
```

Clicking the bell opens the notification center.

Possible notifications include:

* New order received
* New customer registered
* Voucher used
* Low stock alert
* Payment issue
* New contact message
* Campaign completed
* System error

Example:

```text
New Order

Order #KHEM-1042 has been placed.

2 minutes ago
```

---

## 15.1 Notification Center Actions

Provide:

* Mark as read
* Mark all as read
* Open related item
* Appropriate notification timestamps

Unread notifications should be visually identifiable.

---

# 16. Customer Notifications

The notification system should eventually support customers as well.

Customer notifications may include:

* Voucher received
* Credit added
* Order confirmed
* Order shipped
* Delivery update
* Exclusive offer

Example:

```text
A Gift from KHEM House

You received EGP 250 KHEM Credit.

[ View Credit ]
```

The customer notification experience should remain optional and non-intrusive.

---

# 17. Personalized Customer Privileges

The system should support personalized offers in the future.

Instead of relying only on public codes such as:

```text
WELCOME15
```

The system should support customer-specific benefits.

Examples:

```text
KHEM-MOHAMED-2026
```

Or a benefit directly attached to the customer's account.

Example customer experience:

```text
Your Private Offer

15% OFF

Available until August 31.

[ Apply to Order ]
```

This should feel more exclusive and aligned with the KHEM House luxury experience.

---

# 18. Recommended Customer Journey

## Step 1 — Discover

Customer visits KHEM House.

↓

## Step 2 — Join

Customer creates an account.

↓

## Step 3 — Activate

The account is successfully activated.

↓

## Step 4 — Receive Privilege

The system assigns an eligible welcome benefit.

↓

## Step 5 — Welcome

Customer receives the KHEM House welcome email.

↓

## Step 6 — Explore

Customer discovers collections and fragrances.

↓

## Step 7 — Purchase

Customer adds products to cart.

↓

## Step 8 — Apply Benefits

During checkout, the customer can:

* Enter a voucher.
* View available vouchers.
* Apply eligible customer credit.

↓

## Step 9 — Complete Order

Customer completes payment.

↓

## Step 10 — Confirmation

Customer receives order confirmation and relevant notifications.

---

# 19. Recommended Implementation Order

Do not implement every feature in one large change.

The recommended order is:

---

## Priority 1 — Customer Account and Privileges

* [ ] Create custom KHEM account/profile menu.
* [ ] Remove unnecessary Clerk development branding.
* [ ] Create My Vouchers & Credits.
* [ ] Display available customer credit.
* [ ] Display credit transaction history.
* [ ] Display available vouchers.
* [ ] Display voucher status.
* [ ] Add voucher copy functionality.

---

## Priority 2 — Checkout

* [ ] Add voucher input field.
* [ ] Add Apply button.
* [ ] Validate vouchers before payment.
* [ ] Show successful voucher application.
* [ ] Show clear validation errors.
* [ ] Allow voucher removal.
* [ ] Allow users to view eligible vouchers.
* [ ] Add KHEM Credit application.
* [ ] Update order totals instantly.
* [ ] Ensure discounts and credits follow centralized business rules.

---

## Priority 3 — Email Foundation

* [ ] Select and configure the email provider.
* [ ] Create transactional email infrastructure.
* [ ] Implement welcome email.
* [ ] Connect welcome voucher assignment.
* [ ] Implement invitation flow.
* [ ] Prevent duplicate welcome emails.
* [ ] Prepare order confirmation email infrastructure.

---

## Priority 4 — Admin Experience

* [ ] Detect unsaved changes.
* [ ] Create save/discard confirmation dialog.
* [ ] Protect against accidental navigation.
* [ ] Protect against browser refresh or closing where appropriate.
* [ ] Review existing toast notifications.
* [ ] Create persistent notification center.

---

## Priority 5 — Customer Engagement

* [ ] Add customer notifications.
* [ ] Add marketing subscription preferences.
* [ ] Add unsubscribe support.

---

## Priority 6 — Marketing Campaigns

* [ ] Create marketing campaign management.
* [ ] Support discount campaigns.
* [ ] Support new arrival campaigns.
* [ ] Support new collection campaigns.
* [ ] Support seasonal campaigns.
* [ ] Support campaign scheduling.
* [ ] Add audience targeting in a future phase.

---

# 20. Important Technical Rules

Before implementing:

* Inspect the existing database schema.
* Inspect the existing `customer_credits` table.
* Inspect the existing `credit_transactions` table.
* Inspect existing voucher and discount functionality.
* Reuse existing authentication and authorization.
* Do not duplicate existing functionality.
* Do not create conflicting sources of truth.
* Maintain database security and Row Level Security policies.
* Keep financial calculations server-authoritative.
* Do not trust client-side calculations for voucher or credit validation.
* Ensure voucher redemption cannot be exploited through client manipulation.
* Use transactions or equivalent atomic operations when applying credits and completing orders where necessary.
* Keep transactional and marketing email systems logically separated.

---

# 21. Definition of Success

This phase is successful when:

### Customer

* [ ] Can access a polished KHEM account experience.
* [ ] Can see vouchers and credits clearly.
* [ ] Can understand credit history.
* [ ] Can validate and apply vouchers before payment.
* [ ] Can see eligible vouchers without remembering codes.
* [ ] Can understand discounts in the order summary.
* [ ] Receives a proper welcome email.
* [ ] Can manage marketing preferences.

### Administrator

* [ ] Does not accidentally lose unsaved work.
* [ ] Receives useful notifications.
* [ ] Has a persistent notification center.
* [ ] Can eventually manage marketing campaigns.
* [ ] Has clear separation between temporary feedback and persistent notifications.

---

# Final Product Direction

The KHEM website should feel like a **digital House**, not simply an online store.

The experience should communicate:

> Discover the House.
> Become part of it.
> Receive your privileges.
> Experience KHEM.

The customer account should feel personal.

Vouchers and credits should feel like privileges rather than aggressive discounts.

Emails should feel elegant rather than promotional spam.

The admin dashboard should feel reliable and safe.

Every feature should support a premium, refined, and effortless experience consistent with the KHEM House brand.
