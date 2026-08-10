import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";

/**
 * Navigation structure — routes only, no display copy.
 *
 * Labels and descriptions live in the dictionaries and are looked up by `key`,
 * so adding a nav entry without translating it is a compile error rather than
 * an English string leaking into the Arabic tree.
 *
 * Paths are locale-agnostic; `<LocaleLink>` prefixes them at render time.
 */

export type CollectionKey = keyof Dictionary["nav"]["collectionItems"];
export type WorldKey = keyof Dictionary["nav"]["worldItems"];

export const collections: ReadonlyArray<{
  key: CollectionKey;
  path: string;
}> = [
  { key: "signature", path: "/collections/signature" },
  { key: "noir", path: "/collections/noir" },
  { key: "discovery", path: "/discovery" },
  { key: "bodyCare", path: "/body-care" },
  { key: "roomFragrance", path: "/room-fragrance" },
];

export const world: ReadonlyArray<{ key: WorldKey; path: string }> = [
  { key: "heritage", path: "/heritage" },
  { key: "craftsmanship", path: "/craftsmanship" },
  { key: "ingredients", path: "/ingredients" },
  { key: "journal", path: "/journal" },
  { key: "about", path: "/about" },
];
