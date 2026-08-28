"use client";

import { CornerDownLeft, Search, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import HighlightedText from "./HighlightedText";
import {
  addRecentSearch,
  clearRecentSearches,
  useRecentSearches,
} from "./recent-searches";
import ProductPrice from "@/src/components/ecommerce/ProductPrice";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { formatProductType } from "@/src/lib/format";
import { localizePath } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { MAX_QUERY_LENGTH } from "@/src/lib/search/config";
import {
  isSearchable,
  normalizeQuery,
  queryTerms,
  searchHref,
} from "@/src/lib/search/text";
import { LOCALE_PARAM } from "@/src/lib/search/config";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";
import type {
  CollectionSuggestion,
  ProductSuggestion,
  SearchSuggestionsPayload,
} from "@/src/types/search";

/**
 * The search panel — a modal dialog that slides in from the logical end edge.
 *
 * ## Layout
 *
 * Full screen on a phone, 85% of the viewport on a tablet, 75% capped at
 * 1040px from `lg` up. It is anchored to `end`, not `right`: that is the right
 * edge in English and the left edge in Arabic, matching the mobile drawer's
 * `start` anchoring. Transforms are *not* mirrored by `dir`, so the RTL offset
 * is written out explicitly — the same gotcha `Nav.tsx` documents.
 *
 * ## Why it stays mounted
 *
 * Rendering it conditionally would skip the exit transition, so it is always in
 * the tree and `inert` when closed. `inert` also removes it from the tab order
 * and the accessibility tree, which `aria-hidden` alone would not do.
 *
 * ## Debounce
 *
 * 350ms, longer than a purely lexical panel would need: every cache miss on the
 * server is a billed embedding call, so a keystroke that the visitor is about to
 * replace should not become a request.
 */

export interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

const DEBOUNCE_MS = 350;

/** Focusable descendants, for the tab trap. */
const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

type Suggestion =
  | { kind: "product"; item: ProductSuggestion }
  | { kind: "collection"; item: CollectionSuggestion };

export default function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const dict = useDictionary();
  const locale = useLocale();
  const router = useRouter();

  const panelId = "search-overlay";
  const listboxId = useId();

  const [query, setQuery] = useState("");
  /**
   * The last completed response, tagged with the query it answers.
   *
   * Carrying the query inside the state is what removes every "clear the old
   * results" effect: a response is displayed only while it still matches what
   * is in the box, so an edited query falls back to the loading state on its
   * own rather than being reset by a second render pass.
   */
  const [results, setResults] = useState<{
    query: string;
    products: ProductSuggestion[];
    collections: CollectionSuggestion[];
  } | null>(null);
  /** The query whose *request* failed, so the error is scoped to it too. */
  const [failedQuery, setFailedQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(-1);

  const recent = useRecentSearches();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const normalized = normalizeQuery(query);
  const active = isSearchable(normalized);
  const terms = useMemo(() => queryTerms(normalized), [normalized]);

  const current = results?.query === normalized ? results : null;
  const hasFailed = failedQuery === normalized;
  const isLoading = active && current === null && !hasFailed;

  const suggestions: Suggestion[] = useMemo(
    () =>
      current === null
        ? []
        : [
            ...current.products.map((item) => ({ kind: "product" as const, item })),
            ...current.collections.map((item) => ({
              kind: "collection" as const,
              item,
            })),
          ],
    [current],
  );

  /*
   * Two pieces of state adjusted *during render* rather than from an effect —
   * the pattern React documents for "a prop changed, derive from it". An effect
   * would repaint the panel a second time with the stale value still on screen.
   */
  const [previousOpen, setPreviousOpen] = useState(open);
  if (previousOpen !== open) {
    setPreviousOpen(open);
    // Closing resets, so reopening never flashes a stale result set.
    if (!open) {
      setQuery("");
      setResults(null);
      setFailedQuery(null);
      setHighlight(-1);
    }
  }

  const [highlightedQuery, setHighlightedQuery] = useState(normalized);
  if (highlightedQuery !== normalized) {
    setHighlightedQuery(normalized);
    setHighlight(-1);
  }

  // A shrinking result set must not leave the highlight pointing past the end.
  const activeIndex = highlight < suggestions.length ? highlight : -1;

  /*
   * Focus inside `requestAnimationFrame`. Focusing an off-screen input during
   * the first frame of the transition makes iOS Safari scroll the page to chase
   * it, and the panel arrives already displaced.
   */
  useEffect(() => {
    if (!open) return;

    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Lock the page behind the panel, and release the lock on close/unmount.
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  /*
   * The debounced fetch.
   *
   * The abort controller does double duty: it cancels the in-flight request on
   * every keystroke and on close, and — via the `ignore` flag — it stops a slow
   * response for an older query from overwriting a newer one, which is the
   * classic out-of-order bug in a search-as-you-type box.
   */
  useEffect(() => {
    // Nothing to fetch, or the answer for this query is already on screen.
    if (!open || !active || current !== null || hasFailed) return;

    const controller = new AbortController();
    let ignore = false;

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(normalized)}` +
            `&${LOCALE_PARAM}=${encodeURIComponent(locale)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`Search failed: ${response.status}`);

        const payload = (await response.json()) as SearchSuggestionsPayload;
        if (ignore) return;

        setResults({
          query: normalized,
          products: payload.products,
          collections: payload.collections,
        });
      } catch (error) {
        if (ignore || controller.signal.aborted) return;
        // A failed *request* is worth saying; a degraded semantic pass is not,
        // and the server has already resolved that difference for us.
        console.error(error);
        setFailedQuery(normalized);
      }
    }, DEBOUNCE_MS);

    return () => {
      ignore = true;
      clearTimeout(timer);
      controller.abort();
    };
    // `locale` is a dependency, not an incidental read: it is part of the
    // request, so a language switch with the panel open must refetch rather
    // than leave the previous language's suggestions on screen.
  }, [open, active, normalized, current, hasFailed, locale]);

  /** Go to the full results page for `value`. */
  const submit = useCallback(
    (value: string) => {
      const target = normalizeQuery(value);
      if (!isSearchable(target)) return;

      addRecentSearch(target);
      router.push(localizePath(locale, searchHref(target)));
      onClose();
    },
    [locale, onClose, router],
  );

  const openSuggestion = useCallback(
    (suggestion: Suggestion) => {
      addRecentSearch(normalized);
      router.push(localizePath(locale, suggestion.item.href));
      onClose();
    },
    [locale, normalized, onClose, router],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    // A tab trap, not a suggestion: a modal dialog must not leak focus to the
    // page it is covering.
    if (event.key === "Tab") {
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    if (suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      );
    }
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();

    const selected = suggestions[activeIndex];
    if (selected) openSuggestion(selected);
    else submit(query);
  };

  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const countLabel = active
    ? suggestions.length === 0
      ? dict.search.resultCountNone
      : suggestions.length === 1
        ? dict.search.resultCountOne
        : interpolate(dict.search.resultCount, { count: suggestions.length })
    : "";

  return (
    <>
      {/* ── BACKDROP ───────────────────────────────── */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        inert={!open}
        onClick={onClose}
        className={[
          "fixed inset-0 z-1099 cursor-default bg-black/55 backdrop-blur-md",
          "transition-opacity duration-400 ease-luxury-bezier",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      {/* ── PANEL ──────────────────────────────────── */}
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label={dict.search.dialogLabel}
        aria-hidden={!open}
        inert={!open}
        onKeyDown={onKeyDown}
        className={[
          "fixed inset-y-0 end-0 z-1100 flex w-full flex-col overflow-hidden",
          "sm:w-[85%] lg:w-[75%] lg:max-w-260",
          "border-s border-border bg-[color-mix(in_srgb,var(--color-background)_97%,transparent)]",
          "shadow-luxury backdrop-blur-2xl",
          "transition-transform duration-500 ease-luxury-bezier",
          // `dir` does not mirror transforms — the RTL offset is explicit.
          open ? "translate-x-0" : "translate-x-full rtl:-translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex h-20 shrink-0 items-center justify-between px-4 md:px-12">
          <p className="eyebrow">{dict.search.eyebrow}</p>

          <button
            type="button"
            onClick={onClose}
            aria-label={dict.search.close}
            className="-me-2.5 flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-ivory/50 transition-colors duration-300 hover:text-gold"
          >
            <span
              aria-hidden="true"
              className="hidden font-body text-[10px] tracking-[0.25em] sm:inline"
            >
              {dict.search.closeHint}
            </span>
            <X width={20} height={20} strokeWidth={1.25} aria-hidden="true" />
          </button>
        </div>

        {/* Field */}
        <div className="shrink-0 px-4 md:px-12">
          <div className="flex items-center gap-4 border-b border-border pb-5 transition-colors duration-400 ease-luxury-bezier focus-within:border-gold">
            <Search
              width={20}
              height={20}
              strokeWidth={1.25}
              aria-hidden="true"
              className="shrink-0 text-gold/60"
            />

            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeIndex >= 0 ? optionId(activeIndex) : undefined
              }
              aria-label={dict.search.inputLabel}
              placeholder={dict.search.placeholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              // A Latin query typed in the Arabic UI must still read correctly.
              dir="auto"
              maxLength={MAX_QUERY_LENGTH}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              className="w-full min-w-0 bg-transparent font-heading text-2xl tracking-wide text-ivory placeholder:text-ivory/25 focus:outline-none sm:text-3xl"
            />

            {query.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label={dict.search.clear}
                className="shrink-0 cursor-pointer p-1 text-ivory/40 transition-colors duration-300 hover:text-gold"
              >
                <X width={16} height={16} strokeWidth={1.25} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-10 md:px-12">
          <p aria-live="polite" className="sr-only">
            {countLabel}
          </p>

          {!active ? (
            <IdleState
              recent={recent}
              onClearRecent={clearRecentSearches}
              onPick={(value) => {
                setQuery(value);
                inputRef.current?.focus();
              }}
              onClose={onClose}
            />
          ) : isLoading ? (
            <SuggestionSkeleton />
          ) : suggestions.length > 0 ? (
            <div id={listboxId} role="listbox" aria-label={dict.search.products}>
              {current !== null && current.products.length > 0 ? (
                <p className="eyebrow mb-6">{dict.search.products}</p>
              ) : null}

              <div className="flex flex-col">
                {suggestions.map((suggestion, index) => {
                  if (suggestion.kind === "collection") return null;

                  return (
                    <ProductRow
                      key={suggestion.item.id}
                      id={optionId(index)}
                      product={suggestion.item}
                      terms={terms}
                      index={index}
                      isHighlighted={activeIndex === index}
                      onHighlight={() => setHighlight(index)}
                      onSelect={() => openSuggestion(suggestion)}
                      typeLabel={formatProductType(
                        suggestion.item,
                        dict.product.concentrations,
                      )}
                    />
                  );
                })}
              </div>

              {current !== null && current.collections.length > 0 ? (
                <>
                  <p className="eyebrow mb-6 mt-8 md:mt-12">{dict.search.collections}</p>
                  <div className="flex flex-col">
                    {suggestions.map((suggestion, index) => {
                      if (suggestion.kind === "product") return null;

                      return (
                        <CollectionRow
                          key={suggestion.item.id}
                          id={optionId(index)}
                          collection={suggestion.item}
                          terms={terms}
                          index={index}
                          isHighlighted={activeIndex === index}
                          onHighlight={() => setHighlight(index)}
                          onSelect={() => openSuggestion(suggestion)}
                        />
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="max-w-xl">
              <p className="font-heading text-xl text-ivory sm:text-2xl" dir="auto">
                {hasFailed
                  ? dict.search.error
                  : interpolate(dict.search.noResults, { query: normalized })}
              </p>
              <p className="mt-4 text-[13px] leading-loose text-ivory/40">
                {dict.search.noResultsHint}
              </p>

              <p className="eyebrow mb-5 mt-8 md:mt-12">{dict.search.popular}</p>
              <TermChips
                terms={dict.search.popularTerms}
                onPick={(value) => {
                  setQuery(value);
                  inputRef.current?.focus();
                }}
              />
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border px-4 py-5 md:px-12">
          <button
            type="button"
            onClick={() => submit(query)}
            disabled={!active}
            className="flex cursor-pointer items-center gap-2.5 font-body text-[10px] uppercase tracking-[0.25em] text-ivory/40 transition-colors duration-300 hover:text-gold disabled:cursor-default disabled:opacity-40 disabled:hover:text-ivory/40"
          >
            <CornerDownLeft
              width={13}
              height={13}
              strokeWidth={1.25}
              aria-hidden="true"
              className="rtl:-scale-x-100"
            />
            {dict.search.enterHint}
          </button>

          {active && !isLoading ? (
            <span className="font-body text-[10px] tracking-[0.25em] text-ivory/25">
              {countLabel}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}

/* ── Idle ─────────────────────────────────────────── */

function IdleState({
  recent,
  onClearRecent,
  onPick,
  onClose,
}: {
  recent: string[];
  onClearRecent: () => void;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const dict = useDictionary();

  return (
    <div className="grid gap-6 md:gap-12 lg:grid-cols-[1fr_1fr_1.1fr] lg:gap-16">
      {recent.length > 0 ? (
        <section>
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <p className="eyebrow">{dict.search.recent}</p>
            <button
              type="button"
              onClick={onClearRecent}
              className="cursor-pointer font-body text-[10px] uppercase tracking-[0.2em] text-ivory/30 transition-colors duration-300 hover:text-gold"
            >
              {dict.search.clearRecent}
            </button>
          </div>

          <div className="flex flex-col items-start gap-3.5">
            {recent.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => onPick(entry)}
                dir="auto"
                className="group flex max-w-full cursor-pointer items-center gap-3 text-start text-xs tracking-widest text-ivory/50 transition-colors duration-300 hover:text-gold"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-px w-5 shrink-0 bg-current"
                />
                <span className="truncate">{entry}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <p className="eyebrow mb-5">{dict.search.popular}</p>
        <TermChips terms={dict.search.popularTerms} onPick={onPick} />
      </section>

      <section>
        <p className="eyebrow mb-5">{dict.search.collections}</p>
        <div className="flex flex-col gap-4">
          {/*
           * The Nav mega-menu's collections column, reusing its dictionary keys
           * rather than a second copy of the copy. New Arrival is left out — it
           * is a showroom rather than a collection to search within.
           */}
          {(
            [
              ["signature", "/collections/signature"],
              ["gemstone", "/collections/gemstone"],
              ["noir", "/collections/noir"],
              ["bodyCare", "/collections/body-care"],
              ["homeFragrance", "/collections/home-fragrance"],
            ] as const
          ).map(([key, href]) => (
            <LocaleLink
              key={href}
              href={href}
              onClick={onClose}
              className="group block no-underline"
            >
              <p className="mb-1 font-heading text-[13px] tracking-widest text-ivory transition-colors duration-300 group-hover:text-gold">
                {dict.nav.collectionItems[key].label}
              </p>
              <p className="text-[11px] tracking-wider text-ivory/40">
                {dict.nav.collectionItems[key].desc}
              </p>
            </LocaleLink>
          ))}
        </div>
      </section>
    </div>
  );
}

function TermChips({
  terms,
  onPick,
}: {
  terms: readonly { label: string; term: string }[];
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {terms.map(({ label, term }) => (
        <button
          key={term}
          type="button"
          onClick={() => onPick(term)}
          className="cursor-pointer border border-border px-4 py-2 font-body text-[11px] tracking-[0.15em] text-ivory/60 transition-all duration-400 ease-luxury-bezier hover:border-gold/50 hover:text-gold"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── Rows ─────────────────────────────────────────── */

/**
 * Rows fade up in sequence (`.search-row` in `globals.css`).
 *
 * A CSS animation rather than a transition: a transition needs a "before" state
 * to move away from, which would mean rendering the rows invisible and flipping
 * them in a second pass. The delay is capped so a full result set finishes
 * arriving quickly — a staircase is elegant at six rows and tiresome at twenty.
 */
function staggerStyle(index: number) {
  return { animationDelay: `${Math.min(index, 8) * 40}ms` };
}

function ProductRow({
  id,
  product,
  terms,
  index,
  isHighlighted,
  onHighlight,
  onSelect,
  typeLabel,
}: {
  id: string;
  product: ProductSuggestion;
  terms: readonly string[];
  index: number;
  isHighlighted: boolean;
  onHighlight: () => void;
  onSelect: () => void;
  typeLabel: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={isHighlighted}
      onMouseEnter={onHighlight}
      onFocus={onHighlight}
      onClick={onSelect}
      style={staggerStyle(index)}
      className={[
        "search-row group flex w-full cursor-pointer items-center gap-5 border-b border-border/60 px-2 py-4 text-start",
        "transition-colors duration-300 ease-luxury-bezier",
        isHighlighted ? "bg-white/3" : "bg-transparent",
      ].join(" ")}
    >
      <Image
        src={product.image.url}
        alt={product.image.alt}
        width={56}
        height={72}
        sizes="56px"
        className="h-18 w-14 shrink-0 rounded-sm object-cover"
      />

      <span className="min-w-0 flex-1">
        <span className="block truncate font-heading text-sm tracking-wide text-ivory">
          <HighlightedText text={product.name} terms={terms} />
        </span>
        <span className="mt-1 block truncate text-[11px] tracking-wider text-ivory/40">
          {typeLabel ? `${product.collectionName} · ${typeLabel}` : product.collectionName}
        </span>
      </span>

      {/*
        Stacked rather than inline: the row is already three columns wide at
        360px, and a second figure beside the first would push the name into an
        ellipsis. No percentage badge here — a suggestion row is a shortcut, not
        a shelf.
      */}
      <span className="shrink-0 font-heading text-[13px] text-gold/80">
        <ProductPrice
          priceInCents={product.priceInCents}
          promotion={product.promotion}
          stacked
          className="text-[13px] text-gold/80"
        />
      </span>
    </button>
  );
}

function CollectionRow({
  id,
  collection,
  terms,
  index,
  isHighlighted,
  onHighlight,
  onSelect,
}: {
  id: string;
  collection: CollectionSuggestion;
  terms: readonly string[];
  index: number;
  isHighlighted: boolean;
  onHighlight: () => void;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={isHighlighted}
      onMouseEnter={onHighlight}
      onFocus={onHighlight}
      onClick={onSelect}
      style={staggerStyle(index)}
      className={[
        "search-row group flex w-full cursor-pointer items-center gap-4 border-b border-border/60 px-2 py-4 text-start",
        "transition-colors duration-300 ease-luxury-bezier",
        isHighlighted ? "bg-white/3" : "bg-transparent",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className="inline-block h-px w-6 shrink-0 bg-gold/40"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-heading text-sm tracking-wide text-ivory">
          <HighlightedText text={collection.name} terms={terms} />
        </span>
        <span className="mt-1 block truncate text-[11px] tracking-wider text-ivory/40">
          {collection.description}
        </span>
      </span>
    </button>
  );
}

/**
 * Skeleton rows, geometrically identical to the real ones — the point is that
 * nothing moves when the results replace them.
 */
function SuggestionSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col">
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="flex animate-pulse items-center gap-5 border-b border-border/60 px-2 py-4"
        >
          <div className="h-18 w-14 shrink-0 rounded-sm bg-white/5" />
          <div className="flex-1">
            <div className="h-3 w-2/5 rounded-xs bg-white/5" />
            <div className="mt-2.5 h-2.5 w-1/4 rounded-xs bg-white/4" />
          </div>
          <div className="h-3 w-12 rounded-xs bg-white/5" />
        </div>
      ))}
    </div>
  );
}
