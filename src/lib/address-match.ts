/**
 * Whether two addresses name the same place.
 *
 * Shared by the checkout form, which hides "Save this address to my profile"
 * while the fields match an address already in the book, and by
 * `placeCustomerOrder`, which skips the save on the same match. One definition
 * on both sides keeps the checkbox from offering a save the server would refuse
 * as a duplicate, or the reverse.
 *
 * It compares the street, landmark, city and country only. The governorate and
 * postal code are hidden at checkout, and a label or recipient is not part of
 * *where* an address is. Case, padding and runs of whitespace are forgiven,
 * because "12 Road 9 " and "12  road 9" are one door.
 *
 * Pure, with no server imports, so a Client Component can use it.
 */

export interface AddressLike {
  line1: string;
  line2: string | null;
  city: string;
  country: string;
}

function normalise(value: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function sameAddress(a: AddressLike, b: AddressLike): boolean {
  return (
    normalise(a.line1) === normalise(b.line1) &&
    normalise(a.line2) === normalise(b.line2) &&
    normalise(a.city) === normalise(b.city) &&
    normalise(a.country) === normalise(b.country)
  );
}
