"use client";

import { Search, X } from "lucide-react";
import { useRef, useState } from "react";

import AiBadge from "./AiBadge";
import { localizePath } from "@/src/lib/i18n/config";
import { MAX_QUERY_LENGTH, SEARCH_PARAM } from "@/src/lib/search/config";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";

/**
 * The search field on the results page.
 *
 * A real `<form method="get">` pointing at `/search`, so the page works with
 * JavaScript disabled — this is the canonical, linkable, crawlable surface, and
 * the overlay panel is the shortcut to it. The client component adds only the
 * clear button; nothing about submitting depends on hydration.
 *
 * `action` is built with `localizePath()` rather than a bare `/search` so an
 * Arabic search submits back into the Arabic tree.
 */

export interface SearchFormProps {
  defaultValue: string;
  /** Meaning-based search is configured: show the AI-powered badge. */
  semanticSearch?: boolean;
}

export default function SearchForm({ defaultValue, semanticSearch = false }: SearchFormProps) {
  const dict = useDictionary();
  const locale = useLocale();

  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      method="get"
      action={localizePath(locale, "/search")}
      role="search"
      className="border-b border-ground-border px-4 py-6 sm:px-8 lg:px-14 xl:px-20"
    >
      <div className="flex items-center gap-4 transition-colors duration-400 ease-luxury-bezier">
        <Search
          width={18}
          height={18}
          strokeWidth={1.25}
          aria-hidden="true"
          className="shrink-0 text-ground-accent/60"
        />

        <input
          ref={inputRef}
          type="search"
          name={SEARCH_PARAM}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label={dict.search.inputLabel}
          placeholder={dict.search.placeholder}
          dir="auto"
          maxLength={MAX_QUERY_LENGTH}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="w-full min-w-0 bg-transparent font-body text-base text-ground placeholder:text-ground-muted focus:outline-none sm:font-heading sm:text-xl sm:tracking-wide"
        />

        {value.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            aria-label={dict.search.clear}
            className="shrink-0 cursor-pointer p-1 text-ground-muted transition-colors duration-300 hover:text-ground-accent"
          >
            <X width={16} height={16} strokeWidth={1.25} aria-hidden="true" />
          </button>
        ) : null}

        {semanticSearch ? (
          <span className="hidden sm:inline-flex">
            <AiBadge label={dict.search.ai.badge} />
          </span>
        ) : null}

        {/*
         * Visible only without a pointer-driven Enter — but it is what makes
         * the form submittable on a touch keyboard that hides its own return
         * key, and what a no-JS visitor clicks.
         */}
        <button
          type="submit"
          className="btn btn-outline shrink-0 px-6 py-2.5 text-[10px]"
        >
          {dict.search.submit}
        </button>
      </div>
    </form>
  );
}
