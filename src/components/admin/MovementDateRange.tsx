"use client";

/**
 * The date half of the stock-history filters.
 *
 * A Client Component because two date inputs that only take effect on a
 * submit-shaped interaction are worse than two that navigate as they change —
 * an editor narrowing to "yesterday" should not also have to find a button.
 *
 * Every *other* filter on that page is a link (`<FilterChips>`, `<AdminSearch>`),
 * so this carries the current query string forward rather than replacing it:
 * choosing a date must not silently clear the channel someone already picked.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function MovementDateRange({
  basePath,
  from,
  to,
}: {
  basePath: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: "from" | "to", value: string) {
    const next = new URLSearchParams(params.toString());

    if (value) next.set(key, value);
    else next.delete(key);

    const queryString = next.toString();
    router.replace(
      `${pathname === basePath ? basePath : pathname}${queryString ? `?${queryString}` : ""}`,
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
          From
        </span>
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event) => setParam("from", event.target.value)}
          className="border border-ground-border bg-transparent px-3 py-2 text-[12px] text-ground outline-none transition-colors duration-300 focus:border-gold"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
          To
        </span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => setParam("to", event.target.value)}
          className="border border-ground-border bg-transparent px-3 py-2 text-[12px] text-ground outline-none transition-colors duration-300 focus:border-gold"
        />
      </label>
    </div>
  );
}
