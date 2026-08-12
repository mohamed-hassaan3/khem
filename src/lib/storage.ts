/**
 * Guarded `localStorage` access.
 *
 * Two hazards this module exists to contain:
 *
 * 1. **`localStorage` is not always there.** It does not exist during SSR, and
 *    Safari in private mode throws on `setItem` once its quota is reached. Every
 *    access is wrapped; a failure degrades to "no persistence", never to a
 *    crashed render.
 *
 * 2. **Its contents are untrusted input.** A visitor — or a script that reached
 *    the page — can write anything under any key. Values are therefore parsed
 *    through a caller-supplied type guard, and a blob that fails it is treated
 *    as absent rather than thrown. This is the only place in the cart and
 *    wishlist path where unvalidated data enters, and it is where a Zod schema
 *    belongs if validation ever grows beyond these two shapes.
 */

/** Versioned so a future shape change can be introduced without a migration. */
export const CART_STORAGE_KEY = "khem.cart.v1";
export const WISHLIST_STORAGE_KEY = "khem.wishlist.v1";

/**
 * Upper bound on a persisted list. Guards against a crafted blob with a hundred
 * thousand entries forcing a render loop over it.
 */
export const MAX_STORED_ENTRIES = 100;

function getStorage(): Storage | null {
  try {
    // `window` is undefined during SSR; `localStorage` itself throws when
    // cookies are blocked entirely, which is why the access is inside the try.
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Read and validate a persisted value.
 *
 * `isValid` narrows the parsed JSON; anything it rejects — malformed JSON, the
 * wrong shape, a hostile payload — resolves to `fallback`.
 */
export function readStored<T>(
  key: string,
  isValid: (value: unknown) => value is T,
  fallback: T,
): T {
  const storage = getStorage();
  if (storage === null) return fallback;

  try {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;

    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Persist a value, silently doing nothing when storage is unavailable. */
export function writeStored(key: string, value: unknown): void {
  const storage = getStorage();
  if (storage === null) return;

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled — the in-memory state stands.
  }
}

/**
 * Subscribe to changes made to `key` in *another* tab.
 *
 * The `storage` event does not fire in the tab that made the change, so this
 * only ever delivers other tabs' writes — exactly what keeps two open carts in
 * agreement without echoing our own updates back at us.
 */
export function subscribeToStorage(
  key: string,
  onChange: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (event: StorageEvent) => {
    // `key === null` means the whole store was cleared.
    if (event.key === null || event.key === key) onChange();
  };

  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/** Shared guard: a positive integer within the per-line cap. */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Shared guard: a non-empty product id. */
export function isProductId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}
