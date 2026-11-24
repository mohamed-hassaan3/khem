import { ARABIC_INTL_LOCALE } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import type { OrderEvent, OrderStatus } from "@/src/types/account";

/**
 * An order's journey, drawn from its status and its status events.
 *
 * Two drawings of one model:
 *  - `horizontal` — the compact rail on Home and on the desktop overview: three
 *    stations on a line that fills in, gold, to where the parcel is.
 *  - `vertical` — the timeline inside an opened order, newest stop last, each
 *    with the date it was reached.
 *
 * ## The model (moved here from the old `OrderTracker`, unchanged)
 *
 * The journey is Being prepared → On its way → Delivered. A cancelled or
 * refunded order is a *halted* rail: only stations with a real event are drawn,
 * then the halting status — nothing is implied after the line stopped. A date
 * appears only where an `OrderStatusEvent` exists; no station is invented,
 * including a "placed" one the event table does not record.
 *
 * Server Component; the fill animation is CSS (`.acct-rail-fill` in
 * `globals.css`), off under reduced motion.
 */
const JOURNEY = ["PROCESSING", "SHIPPED", "DELIVERED"] as const;
type JourneyStatus = (typeof JOURNEY)[number];
const HALTING: readonly OrderStatus[] = ["CANCELLED", "REFUNDED"];

function isJourneyStatus(status: OrderStatus): status is JourneyStatus {
  return (JOURNEY as readonly OrderStatus[]).includes(status);
}

export type StationState = "done" | "current" | "ahead" | "halted";

export interface Station {
  status: OrderStatus;
  reachedAt: string | null;
  state: StationState;
}

export function buildStations(
  status: OrderStatus,
  events: readonly OrderEvent[],
): readonly Station[] {
  const dates = new Map<OrderStatus, string>(
    events.map((event) => [event.status, event.occurredAt]),
  );

  if (HALTING.includes(status)) {
    const travelled = JOURNEY.filter((stop) => dates.has(stop)).map(
      (stop): Station => ({ status: stop, reachedAt: dates.get(stop) ?? null, state: "done" }),
    );
    return [...travelled, { status, reachedAt: dates.get(status) ?? null, state: "halted" }];
  }

  // A status outside the journey and the halting pair cannot exist, but a stale
  // deployment reading a database that has moved ahead must still draw a rail.
  const currentIndex = isJourneyStatus(status) ? JOURNEY.indexOf(status) : 0;
  return JOURNEY.map((stop, index): Station => ({
    status: stop,
    reachedAt: dates.get(stop) ?? null,
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "ahead",
  }));
}

/** Short station date: "18 Nov" / "18 نوفمبر" (Latin digits in both). */
export function formatStamp(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? ARABIC_INTL_LOCALE : "en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/** Whether an order is still moving — the "in progress" filter and Home's spotlight. */
export function isActiveOrder(status: OrderStatus): boolean {
  return status === "PROCESSING" || status === "SHIPPED";
}

function Dot({ state }: { state: StationState }) {
  const tone =
    state === "halted"
      ? "border-danger/70 bg-danger/70"
      : state === "current"
        ? "border-2 border-ground-accent bg-ground-bg shadow-[0_0_0_4px_color-mix(in_srgb,var(--ground-accent)_15%,transparent)]"
        : state === "done"
          ? "border-ground-accent bg-ground-accent"
          : "border-ground-border bg-ground-bg";

  return (
    <span
      aria-hidden="true"
      className={`relative z-10 block size-[11px] shrink-0 rounded-full border ${tone}`}
    />
  );
}

export interface OrderRailProps {
  status: OrderStatus;
  events: readonly OrderEvent[];
  locale: Locale;
  dict: Dictionary["account"]["orders"]["tracker"];
  variant?: "horizontal" | "vertical";
  /** Horizontal only: print each station's date beneath its label. */
  showDates?: boolean;
}

export default function OrderRail({
  status,
  events,
  locale,
  dict,
  variant = "horizontal",
  showDates = false,
}: OrderRailProps) {
  const stations = buildStations(status, events);
  const count = stations.length;

  // How far along the line the gold runs: from the first station's centre to
  // the last reached one's, as a share of the first-to-last span.
  const lastReached = stations.reduce(
    (last, station, index) => (station.state === "ahead" ? last : index),
    0,
  );
  const fill = count > 1 ? (lastReached / (count - 1)) * 100 : 0;
  const halted = stations.some((station) => station.state === "halted");

  if (variant === "vertical") {
    /*
     * In journey order, top to bottom, like the horizontal rail: newest
     * reached stop last, then what is still ahead. (It used to reverse only
     * the reached stops and then append the ahead ones, which read
     * "On its way → Being prepared → Delivered": backwards, then forwards.)
     * The latest reached stop is the one in gold.
     */
    const headIndex = lastReached;

    return (
      <ol aria-label={dict.label} className="flex flex-col">
        {stations.map((station, index, all) => {
          const isLast = index === all.length - 1;
          const isHead = index === headIndex && station.state !== "ahead";

          return (
            <li
              key={station.status}
              aria-current={station.state === "current" ? "step" : undefined}
              className="grid grid-cols-[20px_1fr] gap-x-3"
            >
              <span className="flex flex-col items-center pt-1">
                <Dot state={station.state} />
                {isLast ? null : (
                  <span
                    aria-hidden="true"
                    className={`my-1 w-px flex-1 ${
                      // Gold only where the parcel has travelled: up to the
                      // next stop, if that stop has been reached.
                      all[index + 1]?.state === "ahead" ? "bg-ground-border" : "bg-ground-accent/60"
                    }`}
                  />
                )}
              </span>

              <span className={isLast ? "" : "pb-4"}>
                <span
                  className={[
                    "block text-[12px]",
                    station.state === "halted"
                      ? "text-danger"
                      : isHead
                        ? "font-semibold text-ground-accent"
                        : station.state === "ahead"
                          ? "text-ground-muted"
                          : "text-ground",
                  ].join(" ")}
                >
                  {dict[station.status]}
                </span>
                {station.reachedAt ? (
                  <span className="mt-0.5 block text-[11px] text-ground-muted">
                    {formatStamp(station.reachedAt, locale)}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    );
  }

  const inset = `${50 / count}%`;

  return (
    <ol
      aria-label={dict.label}
      className="relative grid"
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {/* The line, then the gold run along it. Logical insets, so it fills
          from the right in Arabic. */}
      <span
        aria-hidden="true"
        className="absolute top-[5px] h-px bg-ground-border"
        style={{ insetInlineStart: inset, insetInlineEnd: inset }}
      />
      <span
        aria-hidden="true"
        className={`acct-rail-fill absolute top-[5px] h-px ${halted ? "bg-danger/50" : "bg-ground-accent"}`}
        style={{
          insetInlineStart: inset,
          width: `calc((100% - 2 * ${inset}) * ${fill / 100})`,
        }}
      />

      {stations.map((station) => (
        <li
          key={station.status}
          aria-current={station.state === "current" ? "step" : undefined}
          className="relative flex flex-col items-center gap-2 text-center"
        >
          <Dot state={station.state} />
          <span
            className={[
              "text-[9px] uppercase tracking-[0.14em] rtl:text-[11px] rtl:normal-case rtl:tracking-normal",
              station.state === "halted"
                ? "text-danger"
                : station.state === "current"
                  ? "font-semibold text-ground-accent"
                  : "text-ground-muted",
            ].join(" ")}
          >
            {dict[station.status]}
          </span>
          {showDates ? (
            <span className="-mt-1 text-[11px] text-ground-muted">
              {station.reachedAt ? formatStamp(station.reachedAt, locale) : "—"}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
