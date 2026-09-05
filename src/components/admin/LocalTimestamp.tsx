"use client";

import { useIsHydrated } from "@/src/hooks/use-is-hydrated";
import { formatScheduledAt, localTimeZone } from "@/src/lib/campaign-schedule";

/**
 * A stored instant, in the reader's own clock.
 *
 * ## Why it renders twice
 *
 * The server does not know what zone the desk is sitting in, and guessing would
 * reproduce the bug this exists to prevent. So the first paint — server and the
 * matching hydration render — states the instant in UTC and *says* UTC; from the
 * client render after it, when `Intl` can be asked, it states the same instant
 * in the viewer's zone and says that instead. Both readings are labelled, so
 * neither can be misread as the other, and `useIsHydrated` makes the switch
 * without a mount effect or a cascading render.
 *
 * The zone name is never optional. An admin screen that prints "17:00" without
 * saying whose 17:00 is how a campaign goes out three hours early.
 */
export default function LocalTimestamp({
  iso,
  className,
}: {
  iso: string;
  className?: string;
}) {
  const hydrated = useIsHydrated();
  const zone = hydrated ? localTimeZone() : "UTC";

  return (
    <time dateTime={iso} className={className}>
      {formatScheduledAt(iso, zone || undefined)}
    </time>
  );
}
