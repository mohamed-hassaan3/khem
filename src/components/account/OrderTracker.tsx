import type { Locale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import type { OrderEvent, OrderStatus } from "@/src/types/account";

/**
 * The rail an order travels along.
 *
 * A Server Component with no state and no fetch: it is handed the order's
 * status and the stations it actually reached, and draws them. Everything it
 * prints is stored — the dates come from `"OrderStatusEvent"`
 * (`supabase/sql/0017_order_events.sql`), written inside the same database
 * functions that set the status, so a station cannot be lit for a status that
 * never happened.
 *
 * ## Two rules the drawing follows
 *
 * **A later station implies the earlier ones.** A desk that jumps an order
 * straight from PROCESSING to DELIVERED did put it with a courier; it just did
 * not click the button. Those implied stations are filled but carry no date,
 * because nobody recorded one and inventing it is the thing this whole design
 * exists to avoid.
 *
 * **Cancelled and refunded end the line, they do not extend it.** They are not
 * a fifth stop after DELIVERED. The rail renders the stations the order really
 * reached and then one halted station in the danger tone; the stops it will now
 * never reach are dropped rather than greyed, because a greyed-out "Delivered"
 * under a cancelled order reads as a promise.
 */

/** The journey, in order. Cancelled and refunded are deliberately not here. */
const JOURNEY = ["PROCESSING", "SHIPPED", "DELIVERED"] as const;

type JourneyStatus = (typeof JOURNEY)[number];

/** The two statuses that stop the rail instead of advancing it. */
const HALTING: readonly OrderStatus[] = ["CANCELLED", "REFUNDED"];

function isJourneyStatus(status: OrderStatus): status is JourneyStatus {
  return (JOURNEY as readonly OrderStatus[]).includes(status);
}

type StationState = "done" | "current" | "ahead" | "halted";

interface Station {
  status: OrderStatus;
  /** ISO-8601, or null for a station that was implied rather than recorded. */
  reachedAt: string | null;
  state: StationState;
}

/** True for the states that mean "the order has been here". */
function isReached(state: StationState): boolean {
  return state !== "ahead";
}

function buildStations(
  status: OrderStatus,
  events: readonly OrderEvent[],
): readonly Station[] {
  const dates = new Map<OrderStatus, string>(
    events.map((event) => [event.status, event.occurredAt]),
  );

  if (HALTING.includes(status)) {
    // Only what genuinely happened: a station is on a halted rail if it has an
    // event of its own. Nothing is implied after the line stopped.
    const travelled = JOURNEY.filter((stop) => dates.has(stop)).map(
      (stop): Station => ({
        status: stop,
        reachedAt: dates.get(stop) ?? null,
        state: "done",
      }),
    );

    return [
      ...travelled,
      { status, reachedAt: dates.get(status) ?? null, state: "halted" },
    ];
  }

  // A status outside the journey and outside the halting pair cannot exist —
  // `OrderStatus` has six members and this covers all of them — but a stale
  // deployment reading a database that has moved ahead must still draw a rail.
  const currentIndex = isJourneyStatus(status) ? JOURNEY.indexOf(status) : 0;

  return JOURNEY.map((stop, index): Station => ({
    status: stop,
    reachedAt: dates.get(stop) ?? null,
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "ahead",
  }));
}

/** Day and short month, in the reader's language. Never a stored string. */
function formatStamp(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export interface OrderTrackerProps {
  status: OrderStatus;
  events: readonly OrderEvent[];
  locale: Locale;
  dict: Dictionary["account"]["orders"]["tracker"];
}

export default function OrderTracker({
  status,
  events,
  locale,
  dict,
}: OrderTrackerProps) {
  const stations = buildStations(status, events);
  if (stations.length === 0) return null;

  return (
    <ol
      aria-label={dict.label}
      className="flex flex-col sm:flex-row sm:items-start"
    >
      {stations.map((station, index) => {
        const next = stations[index + 1];
        const isLast = next === undefined;

        // The segment leaving this station is lit when the station it leads to
        // has been reached. A halted stop is reached, but its approach stays
        // unlit — the line did not continue, it stopped.
        const litAhead =
          next !== undefined && next.state !== "ahead" && next.state !== "halted";

        const dotTone =
          station.state === "halted"
            ? "border-danger/70 bg-danger/70"
            : isReached(station.state)
              ? "border-gold bg-gold"
              : "border-ground-border bg-stone";

        const ring =
          station.state === "current"
            ? " ring-1 ring-gold/40 ring-offset-2 ring-offset-surface"
            : "";

        return (
          <li
            key={station.status}
            aria-current={station.state === "current" ? "step" : undefined}
            className={`relative flex gap-4 sm:block sm:flex-1 sm:gap-0 sm:text-center${
              isLast ? "" : " pb-7 sm:pb-0"
            }`}
          >
            {/* Vertical connector (mobile) — behind the dot, hence the -z. */}
            {isLast ? null : (
              <span
                aria-hidden="true"
                className={`absolute top-3 bottom-0 start-[4.5px] w-px sm:hidden ${
                  litAhead ? "bg-gold/40" : "bg-border"
                }`}
              />
            )}

            {/* Horizontal connector (sm and up) — from this dot's centre to
                the next one's. Mirrors in Arabic because it is anchored with
                the logical `start` edge. */}
            {isLast ? null : (
              <span
                aria-hidden="true"
                className={`absolute top-[4.5px] hidden h-px w-full sm:block sm:start-1/2 ${
                  litAhead ? "bg-gold/40" : "bg-border"
                }`}
              />
            )}

            <span
              aria-hidden="true"
              className={`relative z-10 mt-[3px] size-2.5 shrink-0 rounded-full border transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:mx-auto sm:mt-0 ${dotTone}${ring}`}
            />

            <span className="block sm:mt-4">
              <span
                className={`block font-heading text-[9px] uppercase tracking-[0.15em] ${
                  station.state === "halted"
                    ? "text-danger/80"
                    : isReached(station.state)
                      ? "text-ground-muted"
                      : "text-ground-muted/70"
                }`}
              >
                {dict[station.status]}
              </span>

              {station.reachedAt ? (
                <span className="mt-1 block text-[10px] text-ground-muted/70">
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
