"use client";

import { ChevronDown, Clock, ExternalLink, MapPin, Phone } from "lucide-react";
import Image from "next/image";
import { useState, type ReactNode } from "react";

import StockistBadge from "@/src/components/stockists/StockistBadge";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland, type LtrIsland } from "@/src/lib/i18n/rtl";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import type { Stockist, StockistRegion } from "@/src/types/stockist";

/**
 * Region filter, map panel, and expandable location list.
 *
 * The client boundary stops here: the page stays a Server Component and passes
 * already-queried records in, so `src/services/stockists.ts` is never pulled
 * into the browser bundle. Filtering is client-side on purpose — driving it
 * from `?region=` would opt the route out of ISR (AGENTS.md §8 lists
 * `/stockists` as static).
 *
 * Nothing here is written against "one stockist". The bar, the count, the chip
 * rail, and the list all map over the array; the only concession to today's
 * data is that a lone location opens expanded rather than making the visitor
 * hunt for a click target.
 *
 * Announced locations (`status: "comingSoon"`) appear in the list and on the
 * chip rail but are deliberately **not** interactive: they have no contact
 * details, so a control that expanded one would promise information that does
 * not exist. They are also excluded from the count — see `openCount`.
 */

/**
 * The map is a graded texture, not a map — there is no interactive map
 * provider in this project, and adding one is its own task (a runtime
 * dependency plus an API key). It carries `alt=""` accordingly: it conveys
 * atmosphere, and every piece of real information sits in the overlay and the
 * list beside it.
 */
const MAP_TEXTURE =
  "https://images.unsplash.com/photo-1678287714479-adaa0cfbe6c6?w=1200&h=700&fit=crop&auto=format";

/** The `stockists` dictionary block, passed down rather than re-read per row. */
type StockistLabels = Dictionary["stockists"];

export interface StockistDirectoryProps {
  stockists: Stockist[];
  /** Regions present in the data, taxonomy order. Rendered after an "All" tab. */
  regions: StockistRegion[];
  locale: Locale;
}

export default function StockistDirectory({
  stockists,
  regions,
  locale,
}: StockistDirectoryProps) {
  const dict = useDictionary();
  const island = ltrIsland(locale);

  /** `null` means "All Regions". */
  const [activeRegion, setActiveRegion] = useState<StockistRegion | null>(null);

  /**
   * A single *expandable* location opens expanded: with one row to open there
   * is nothing to choose between, and hiding the address behind a click is
   * friction for its own sake. With two or more, the visitor picks.
   *
   * Counted over open locations rather than all of them. Announced locations
   * do not expand, so an announcement must not push the one real boutique's
   * details behind a click it did not need before.
   */
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const expandable = stockists.filter(
      (stockist) => stockist.status === "open",
    );
    return expandable.length === 1 ? (expandable[0]?.id ?? null) : null;
  });

  const matchesRegion = (stockist: Stockist, region: StockistRegion | null) =>
    region === null || stockist.region === region;

  const filtered = stockists.filter((stockist) =>
    matchesRegion(stockist, activeRegion),
  );

  /**
   * The count line reads open locations only. A boutique that has been
   * announced but not opened is not a "location worldwide" — it is still
   * listed and labelled below, just not counted as somewhere you can go.
   */
  const openCount = filtered.filter(
    (stockist) => stockist.status === "open",
  ).length;

  function handleRegionChange(region: StockistRegion | null) {
    setActiveRegion(region);

    // Drop a selection the new filter would hide, so the expanded row is never
    // one that just left the list.
    const stillVisible = stockists.some(
      (stockist) =>
        stockist.id === selectedId && matchesRegion(stockist, region),
    );
    if (!stillVisible) setSelectedId(null);
  }

  const toggleSelected = (id: string) =>
    setSelectedId((previous) => (previous === id ? null : id));

  return (
    <>
      {/* ── REGION FILTER ───────────────────────────── */}
      <nav
        aria-label={dict.stockists.filterLabel}
        className="border-b border-border bg-background"
      >
        <div className="mx-auto flex max-w-350 gap-9 overflow-x-auto px-6 md:px-20">
          <RegionTab
            label={dict.stockists.regionAll}
            isActive={activeRegion === null}
            onSelect={() => handleRegionChange(null)}
          />

          {regions.map((region) => (
            <RegionTab
              key={region}
              label={dict.stockists.regions[region]}
              isActive={activeRegion === region}
              onSelect={() => handleRegionChange(region)}
            />
          ))}
        </div>
      </nav>

      {/* ── MAP PANEL + DIRECTORY ───────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_440px]">
        {/* Map column */}
        <div className="relative min-h-100 overflow-hidden border-b border-border bg-surface lg:min-h-150 lg:border-b-0 lg:border-e">
          <Image
            src={MAP_TEXTURE}
            alt=""
            fill
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover brightness-[0.15] saturate-0 sepia-[0.3]"
          />

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
            <div className="gold-line" />

            <p className="font-heading text-[13px] tracking-[0.15em] text-gold/50">
              {interpolate(
                openCount === 1
                  ? dict.stockists.countOne
                  : dict.stockists.countOther,
                { count: openCount },
              )}
            </p>

            <div className="flex max-w-100 flex-wrap justify-center gap-2">
              {filtered.map((stockist) => {
                const chipClasses =
                  "border px-3.5 py-1.5 font-heading text-[9px] tracking-[0.15em]";

                /*
                 * An announced location is a label, not a control: selecting
                 * it would expand a row that has nothing to show. The dashed
                 * border carries that visually; the `sr-only` suffix carries
                 * it to assistive technology.
                 */
                if (stockist.status === "comingSoon") {
                  return (
                    <span
                      key={stockist.id}
                      className={`${chipClasses} border-dashed border-gold/15 text-ivory/25`}
                    >
                      {/* The island wraps the city name only — the status
                          annotation beside it is translated chrome. */}
                      <span {...island}>{stockist.city}</span>
                      <span className="sr-only">
                        {` — ${dict.stockists.comingSoon}`}
                      </span>
                    </span>
                  );
                }

                const isSelected = selectedId === stockist.id;

                return (
                  <button
                    key={stockist.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleSelected(stockist.id)}
                    className={`${chipClasses} cursor-pointer transition-colors duration-300 ease-out focus-visible:border-gold focus-visible:outline-none ${
                      isSelected
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-gold/20 text-ivory/40 hover:text-ivory/70"
                    }`}
                    {...island}
                  >
                    {stockist.city}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/*
         * The scroll region only exists from `lg`. Reserving one on mobile
         * traps a short list inside a box the page would otherwise scroll past
         * naturally.
         */}
        <div className="lg:max-h-150 lg:overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((stockist) => (
              <StockistRow
                key={stockist.id}
                stockist={stockist}
                isSelected={selectedId === stockist.id}
                onToggle={() => toggleSelected(stockist.id)}
                island={island}
                labels={dict.stockists}
              />
            ))
          ) : (
            <p className="px-6 py-16 text-center text-sm text-ivory/40">
              {dict.stockists.empty}
            </p>
          )}
        </div>
      </section>
    </>
  );
}

/** One tab in the region bar. Styling mirrors `<CollectionTab>`. */
function RegionTab({
  label,
  isActive,
  onSelect,
}: {
  label: string;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onSelect}
      className={`cursor-pointer whitespace-nowrap border-b-2 py-5 font-heading text-[11px] tracking-[0.2em] transition-colors duration-300 ease-out focus-visible:outline-none ${
        isActive
          ? "border-gold text-gold"
          : "border-transparent text-ivory/40 hover:text-ivory/70 focus-visible:text-gold"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * One location in the directory.
 *
 * For an **open** location the header is a real `<button>` — the original
 * clickable `<div>` was not focusable, not keyboard-operable, and announced
 * nothing. The detail panel is a *sibling* of that button rather than a child:
 * it holds a `tel:` link and an external link, and an `<a>` inside a
 * `<button>` is invalid HTML that breaks keyboard traversal.
 *
 * For an **announced** location the header is a plain `<div>`: there is
 * nothing to expand to, so there is no control, no focus stop, and no
 * chevron. Its badge shows the status rather than the store type — the useful
 * fact about a store that has not opened is that it has not opened.
 */
function StockistRow({
  stockist,
  isSelected,
  onToggle,
  island,
  labels,
}: {
  stockist: Stockist;
  isSelected: boolean;
  onToggle: () => void;
  island: LtrIsland;
  labels: StockistLabels;
}) {
  const detailId = `stockist-detail-${stockist.id}`;
  const isComingSoon = stockist.status === "comingSoon";

  /** Name and location — identical in both branches. */
  const heading = (
    <span className="min-w-0">
      {/* Store records come from the database — English only. */}
      <span
        className={`mb-1 block font-heading text-[15px] font-normal ${
          isComingSoon ? "text-ivory/60" : "text-ivory"
        }`}
        {...island}
      >
        {stockist.name}
      </span>
      <span
        className={`block text-[11px] tracking-[0.1em] ${
          isComingSoon ? "text-gold/35" : "text-gold/60"
        }`}
        {...island}
      >
        {stockist.city}, {stockist.country}
      </span>
    </span>
  );

  if (isComingSoon) {
    return (
      <div className="border-b border-s-3 border-border border-s-transparent">
        <div className="flex items-start justify-between gap-4 px-6 py-7 md:px-9">
          {heading}
          <span className="shrink-0 whitespace-nowrap border border-dashed border-gold/25 px-2.5 py-1 font-heading text-[9px] tracking-[0.15em] text-gold/50">
            {labels.comingSoon}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border-b border-s-3 border-border transition-colors duration-300 ease-out ${
        isSelected ? "border-s-gold bg-gold/6" : "border-s-transparent"
      }`}
    >
      <button
        type="button"
        aria-expanded={isSelected}
        aria-controls={detailId}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start justify-between gap-4 px-6 py-7 text-start focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold md:px-9"
      >
        {heading}

        <span className="flex shrink-0 items-center gap-3">
          <StockistBadge
            label={labels.types[stockist.type]}
            type={stockist.type}
          />
          <ChevronDown
            size={14}
            strokeWidth={1.25}
            aria-hidden="true"
            className={`text-ivory/30 transition-transform duration-300 ease-out ${
              isSelected ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      {isSelected ? (
        <div
          id={detailId}
          className="border-t border-border px-6 pb-7 pt-5 md:px-9"
        >
          <StockistDetails stockist={stockist} island={island} labels={labels} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Address, telephone, hours, and the directions link.
 *
 * Exported because the page's editorial feature renders the same block — one
 * definition of what a location's details look like, rather than two that
 * drift. Each label is exposed to assistive technology while the icon carries
 * it visually.
 */
export function StockistDetails({
  stockist,
  island,
  labels,
}: {
  stockist: Stockist;
  island: LtrIsland;
  labels: StockistLabels;
}) {
  /*
   * Every field is nullable — an announced location has none of them. Each is
   * narrowed rather than defaulted: a row is absent when there is nothing to
   * put in it, and `href` is never emitted from a null, which React would
   * render as an anchor pointing at the current page.
   */
  const { address, phone, phoneHref, hours, mapsUrl } = stockist;

  return (
    <>
      <dl className="space-y-3">
        {address ? (
          <DetailRow
            icon={<MapPin size={13} strokeWidth={1.25} aria-hidden="true" />}
          >
            <dt className="sr-only">{labels.address}</dt>
            <dd
              className="text-[12px] leading-relaxed text-ivory/50"
              {...island}
            >
              {address}
            </dd>
          </DetailRow>
        ) : null}

        {phone && phoneHref ? (
          <DetailRow
            icon={<Phone size={13} strokeWidth={1.25} aria-hidden="true" />}
          >
            <dt className="sr-only">{labels.telephone}</dt>
            <dd>
              {/*
               * `dir="ltr"` regardless of locale: a phone number is a Latin
               * numeral run, and RTL context reorders its `+` prefix.
               */}
              <a
                href={phoneHref}
                dir="ltr"
                className="inline-block text-[11px] text-ivory/40 no-underline transition-colors duration-300 ease-out hover:text-gold focus-visible:text-gold focus-visible:outline-none"
              >
                {phone}
              </a>
            </dd>
          </DetailRow>
        ) : null}

        {hours ? (
          <DetailRow
            icon={<Clock size={13} strokeWidth={1.25} aria-hidden="true" />}
          >
            <dt className="sr-only">{labels.hours}</dt>
            <dd className="text-[11px] text-ivory/40" {...island}>
              {hours}
            </dd>
          </DetailRow>
        ) : null}
      </dl>

      {mapsUrl ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={interpolate(labels.directionsFor, { name: stockist.name })}
          className="mt-6 inline-flex items-center gap-2 font-heading text-[10px] tracking-[0.15em] text-gold no-underline transition-colors duration-300 ease-out hover:text-champagne focus-visible:text-champagne focus-visible:outline-none"
        >
          {labels.directions}
          <ExternalLink size={11} strokeWidth={1.25} aria-hidden="true" />
        </a>
      ) : null}
    </>
  );
}

function DetailRow({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-gold/50">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
