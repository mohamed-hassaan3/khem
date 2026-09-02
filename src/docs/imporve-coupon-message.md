# Improve Coupon Error Messages

Audit the coupon/discount validation flow and improve the error messages shown to customers when entering a coupon code.

The goal is to clearly explain **why a real coupon cannot be applied**, so the customer does not think the code is fake or broken.

Detect the actual reason from the existing discount rules and show a specific customer-friendly message.

Examples:

- **Coupon does not exist**
  → "This coupon code is not valid."

- **Coupon has expired**
  → "This coupon code has expired."

- **Coupon is not active yet**
  → "This coupon code is not available yet."

- **Coupon is limited to specific collections**
  → "This coupon is valid only for selected collections."

  If appropriate and safe to expose, clearly mention the eligible collection, for example:
  → "This coupon is valid only for the KHEM NOIR Collection."

- **Cart does not contain an eligible product**
  → Clearly explain that none of the current products qualify for this coupon.

- **Minimum order requirement not reached**
  → Show the required minimum amount.

- **Coupon usage limit has been reached**
  → "This coupon has reached its usage limit."

- **Customer has already used a one-time coupon**
  → "You have already used this coupon."

- **Coupon is restricted to specific customers / invitation only**
  → Explain that the offer is not available for the current account without exposing sensitive information.

- **Coupon cannot be combined with another discount**
  → Clearly explain the conflict.

## Important

- First inspect the existing discount/coupon engine and all existing validation states.
- Do not duplicate validation logic only for UI messages.
- Return or expose a structured error/reason from the existing validation system where possible.
- The frontend should display the correct message based on the actual validation result.
- Never tell the customer a coupon is "invalid" if it is actually valid but does not apply to their current cart.
- Keep messages short, elegant, and customer-friendly.
- Support both English and Arabic using the existing i18n system.
- Do not reveal sensitive internal discount rules or private campaign information.

The same validation and clear error messages should work consistently in both the Cart and Checkout.