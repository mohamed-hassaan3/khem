"use client";

/**
 * The only module in the repository that imports a charting library.
 *
 * ## Why it is a client component, and the only one
 *
 * lightweight-charts draws to a canvas: it needs `window`, a laid-out element
 * to measure, and a teardown. None of that can happen on the server. Keeping
 * the import in exactly one file means the ~45kB library is in one chunk, the
 * dashboard's other screens never pay for it, and the day the library's series
 * API changes — v4's `addAreaSeries()` became v5's `addSeries(AreaSeries, …)` —
 * there is one file to change.
 *
 * What crosses the boundary is a plain array of `{ time, value }`. The server
 * has already aggregated, gap-filled and converted piastres to pounds, so
 * nothing here performs arithmetic on money and no query hides behind a chart.
 *
 * ## The palette
 *
 * Gold line, gold-soft wash, hairline grid on obsidian — the same tokens as the
 * rest of the desk, applied to a canvas that knows nothing about Tailwind.
 * Written as literals because the library takes colour strings, not classes;
 * they mirror `--color-gold`, `--color-gold-soft` and `--color-border`.
 */

import {
  AreaSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

const GOLD = "#c8a96a";

export interface ChartPoint {
  /** `YYYY-MM-DD`, ascending and unique — the library requires all three. */
  time: string;
  value: number;
}

export default function SalesChart({
  points,
  kind,
  unit,
  height = 260,
}: {
  points: readonly ChartPoint[];
  /** Revenue reads as a continuous quantity; units sold are discrete events. */
  kind: "area" | "histogram";
  /** Suffix/prefix for the price scale and the crosshair label. */
  unit: "egp" | "units";
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        // Transparent rather than the panel colour: the chart then sits on
        // whatever surface it is dropped into without a seam.
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(247, 244, 236, 0.35)",
        fontSize: 10,
        fontFamily:
          "var(--font-body), ui-sans-serif, system-ui, -apple-system, sans-serif",
        attributionLogo: false,
      },
      grid: {
        // Horizontal only. Vertical gridlines on a 90-day series turn the panel
        // into a ledger, which is the opposite of the house look.
        vertLines: { visible: false },
        horzLines: { color: "rgba(255, 255, 255, 0.06)" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.2, bottom: 0.05 },
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        vertLine: { color: "rgba(200, 169, 106, 0.4)", width: 1, style: 0, labelBackgroundColor: GOLD },
        horzLine: { color: "rgba(200, 169, 106, 0.4)", width: 1, style: 0, labelBackgroundColor: GOLD },
      },
      localization: {
        locale: "en-US",
        priceFormatter: (value: number) =>
          unit === "egp"
            ? `EGP ${Math.round(value).toLocaleString("en-US")}`
            : `${Math.round(value)}`,
      },
      // A dashboard panel is read, not explored. Scroll and zoom would let an
      // editor drag the series out of frame with a trackpad gesture they did
      // not mean to make, with no obvious way back.
      handleScroll: false,
      handleScale: false,
    });

    const series =
      kind === "area"
        ? chart.addSeries(AreaSeries, {
            lineColor: GOLD,
            topColor: "rgba(200, 169, 106, 0.28)",
            bottomColor: "rgba(200, 169, 106, 0.01)",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          })
        : chart.addSeries(HistogramSeries, {
            color: "rgba(230, 214, 168, 0.55)",
            priceLineVisible: false,
            lastValueVisible: false,
          });

    series.setData(
      points.map((point) => ({
        time: point.time as unknown as UTCTimestamp,
        value: point.value,
      })),
    );
    chart.timeScale().fitContent();

    chartRef.current = chart;

    // Width follows the panel; height never does, so the surrounding layout
    // cannot shift while the chart settles.
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width && width > 0) chart.applyOptions({ width });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [points, kind, unit, height]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full"
      aria-hidden="true"
    />
  );
}
