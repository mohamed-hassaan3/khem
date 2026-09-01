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
 * Gold line, low-alpha gold wash, hairline grid **on ivory** — the same tokens
 * as the rest of the desk, applied to a canvas that knows nothing about
 * Tailwind. Written as literals because the library takes colour strings, not
 * classes; they mirror `--color-gold-deep`, `--color-gold`, `--color-ink-muted`
 * and `--color-border-light`.
 *
 * These were the obsidian values — ivory type at 35% opacity, white gridlines
 * at 6% — from a desk that was dark. `<AdminShell>` is `ground-ivory`, so that
 * palette painted near-white text onto `#f7f5f0`: the axis dates, the axis
 * figures, the gridlines and the crosshair labels were all being drawn, and all
 * invisible. That is the whole of the "analytics shows no dates or numbers"
 * fault — the series, the gap-filling and the RPCs behind them were correct and
 * are untouched.
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

/*
 * `--color-gold-deep`: the gold that survives on a light ground (~4.9:1 on
 * ivory). `--color-gold` itself is ~2.6:1 there and was what made the line read
 * as a smudge rather than as a series.
 */
const GOLD_DEEP = "#8a6a3f";

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
        // `--color-ink-muted`, the colour every other label on the desk is set
        // in. This is the value that puts the dates back on the axis.
        textColor: "#625f58",
        fontSize: 10,
        // A literal stack, not `var(--font-body)`: a canvas font shorthand is
        // parsed by the 2D context, which cannot resolve a custom property —
        // the whole declaration was being dropped and the axis fell back to the
        // browser default face.
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
        attributionLogo: false,
      },
      grid: {
        // Horizontal only. Vertical gridlines on a 90-day series turn the panel
        // into a ledger, which is the opposite of the house look.
        vertLines: { visible: false },
        // `--color-border-light`, softened. A white hairline on paper is nothing.
        horzLines: { color: "rgba(216, 211, 202, 0.9)" },
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
        vertLine: { color: "rgba(138, 106, 63, 0.4)", width: 1, style: 0, labelBackgroundColor: GOLD_DEEP },
        horzLine: { color: "rgba(138, 106, 63, 0.4)", width: 1, style: 0, labelBackgroundColor: GOLD_DEEP },
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
            lineColor: GOLD_DEEP,
            topColor: "rgba(176, 141, 87, 0.26)",
            bottomColor: "rgba(176, 141, 87, 0.02)",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          })
        : chart.addSeries(HistogramSeries, {
            // Champagne at 55% was a bar the same value as the paper behind it.
            color: "rgba(176, 141, 87, 0.7)",
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
