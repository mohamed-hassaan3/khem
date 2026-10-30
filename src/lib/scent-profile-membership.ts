import type { ScentProfileSlug } from "@/src/lib/scent-profiles";

export interface ProfileMembership {
  profileSlug: ScentProfileSlug;
  productSlug: string;
  sortOrder: number;
}

export function diffScentProfileMemberships(
  current: readonly ScentProfileSlug[],
  requested: readonly ScentProfileSlug[],
  eligible: boolean,
): { add: ScentProfileSlug[]; remove: ScentProfileSlug[] } {
  const next = new Set(eligible ? requested : []);
  const previous = new Set(current);
  return {
    add: [...next].filter((slug) => !previous.has(slug)),
    remove: [...previous].filter((slug) => !next.has(slug)),
  };
}

/** A reorder must describe every stored member once and may not introduce one. */
export function isExactProfileOrder(
  storedSlugs: readonly string[],
  requestedSlugs: readonly string[],
): boolean {
  if (storedSlugs.length !== requestedSlugs.length) return false;
  const stored = new Set(storedSlugs);
  return (
    stored.size === storedSlugs.length &&
    new Set(requestedSlugs).size === requestedSlugs.length &&
    requestedSlugs.every((slug) => stored.has(slug))
  );
}
