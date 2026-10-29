/** Collection codes used by KHEM's catalog SKU format. */
export const SKU_COLLECTION_CODES: Readonly<Record<string, string>> = {
  signature: "SIG",
  gemstone: "GEM",
  noir: "NOI",
  "body-mist": "BOD",
  "room-spray": "HOM",
  "discovery-sets": "DIS",
  "gift-sets": "GFT",
};

export const SKU_MAX_LENGTH = 64;

const FILLER_WORDS = new Set(["a", "an", "and", "de", "eau", "of", "the"]);
const FORMAT_WORDS = new Set([
  "body",
  "fragrance",
  "mist",
  "oil",
  "parfum",
  "perfume",
  "room",
  "set",
  "sets",
  "spray",
]);

export interface ProductSkuParts {
  collectionSlug: string;
  name: string;
  volumeMl: string | number | null | undefined;
  /** False when product type hides the volume field, even if stale state remains. */
  volumeVisible: boolean;
}

function collectionCode(slug: string): string | null {
  const known = SKU_COLLECTION_CODES[slug];
  if (known) return known;

  const letters = slug.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase();
  return letters.length === 3 ? letters : null;
}

function nameCode(name: string): string | null {
  const words = name.match(/[a-z]+/gi) ?? [];
  const meaningful = words.find((word) => {
    const normalized = word.toLowerCase();
    return !FILLER_WORDS.has(normalized) && !FORMAT_WORDS.has(normalized);
  });

  return meaningful ? meaningful.slice(0, 3).toUpperCase() : null;
}

function volumeCode(value: ProductSkuParts["volumeMl"]): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) return null;

  const volume = Number(raw);
  if (!Number.isSafeInteger(volume) || volume <= 0) return null;
  return String(volume).padStart(3, "0");
}

/** Build a catalog SKU; unavailable parts are omitted without inventing text. */
export function generateProductSku({
  collectionSlug,
  name,
  volumeMl,
  volumeVisible,
}: ProductSkuParts): string {
  const parts = [collectionCode(collectionSlug), nameCode(name)];
  if (volumeVisible) parts.push(volumeCode(volumeMl));

  const sku = `KHEM-${parts.filter((part): part is string => part !== null).join("-")}`;
  if (parts.every((part) => part === null)) return "";

  return /^[A-Za-z0-9._-]{2,64}$/.test(sku) ? sku : "";
}

/** Add a numeric collision suffix while keeping the catalog SKU schema valid. */
export function skuWithSuffix(base: string, suffix: number): string {
  const tail = `-${suffix}`;
  const prefix = base.slice(0, SKU_MAX_LENGTH - tail.length).replace(/[-._]+$/g, "");
  const candidate = `${prefix}${tail}`;
  return /^[A-Za-z0-9._-]{2,64}$/.test(candidate) ? candidate : "";
}
