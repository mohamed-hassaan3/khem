import { formatShopDateTime } from "@/src/lib/shop-time";

/**
 * A stored instant on the boutique's clock: "19 Nov 2026, 17:10 Cairo".
 *
 * It used to render twice — UTC on the server, then the viewer's own zone after
 * hydration — because "local" could only be known in the browser. The admin
 * now keeps one clock, Africa/Cairo (`src/lib/shop-time.ts`), so the server and
 * the browser print the same string and a single render is enough. The name is
 * kept to avoid churn in its callers.
 *
 * The zone name is never optional. An admin screen that prints "17:00" without
 * saying whose 17:00 is how a campaign goes out at the wrong hour.
 */
export default function LocalTimestamp({
  iso,
  className,
}: {
  iso: string;
  className?: string;
}) {
  return (
    <time dateTime={iso} className={className}>
      {formatShopDateTime(iso)}
    </time>
  );
}
