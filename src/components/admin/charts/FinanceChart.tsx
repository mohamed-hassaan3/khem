"use client";

/**
 * The finance charts: two or three series on one canvas, with an optional
 * target line across it.
 *
 * ## Why this is not `<SalesChart>`
 *
 * That component draws exactly one series and is read by `/admin/analytics`.
 * Finance needs revenue *against* expenses *against* net profit on the same
 * axis, and revenue against a horizontal target — neither of which one series
 * can express, and both of which would have meant reshaping a working screen's
 * component to serve a new one. Same library, same palette, same teardown
 * discipline; a second file rather than a riskier first one.
 *
 * What crosses the boundary is plain arrays of `{ time, value }`. The server has
 * already aggregated, gap-filled and converted piastres to pounds, so nothing
 * here performs arithmetic on money and no query hides behind a chart.
 *
 * ## Gaps are not zeros
 *
 * A point whose value is `null` is passed to the library as *whitespace* — a
 * time with no data — rather than as 0. That is the profit series when nothing
 * in a period carried a cost: the line stops, and a reader sees an absence
 * instead of a month in which the boutique apparently made nothing.
 *
 * ## The palette
 *
 * The tokens the rest of the desk uses, written as literals because the library
 * takes colour strings rather than classes: `--color-gold-deep` for the figure
 * that matters, ink-muted for the one being compared against, and danger for
 * expenses — money leaving is the one thing on this screen that should read
 * differently from money arriving.
 */

import {
  AreaSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

/** `--color-gold-deep`: the gold that survives on a light ground (~4.9:1). */
const GOLD_DEEP = "#8a6a3f";
/** `--color-ink-muted`, the colour every other label on the desk is set in. */
const INK_MUTED = "#625f58";
/** `--color-danger`, softened. Money leaving the house. */
const CLARET = "#9c4a3c";

export interface FinanceSeries {
  /** Announced in the panel's caption; the canvas itself is `aria-hidden`. */
  label: string;
  /** `null` draws a gap, never a zero. */
  points: readonly { time: string; value: number | null }[];
  kind: "area" | "line" | "histogram";
  tone: "gold" | "muted" | "danger";
}

const TONES = {
  gold: GOLD_DEEP,
  muted: INK_MUTED,
  danger: CLARET,
} as const;

export default function FinanceChart({
  series,
  targetValue = null,
  height = 260,
}: {
  series: readonly FinanceSeries[];
  /** A horizontal line across the chart — the month's target, in pounds. */
  targetValue?: number | null;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart: IChartApi = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        // Transparent rather than the panel colour: the chart then sits on
        // whatever surface it is dropped into without a seam.
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: INK_MUTED,
        fontSize: 10,
        // A literal stack, not `var(--font-body)`: a canvas font shorthand is
        // parsed by the 2D context, which cannot resolve a custom property.
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
        attributionLogo: false,
      },
      grid: {
        // Horizontal only. Vertical gridlines turn the panel into a ledger,
        // which is the opposite of the house look.
        vertLines: { visible: false },
        horzLines: { color: "rgba(216, 211, 202, 0.9)" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.2, bottom: 0.05 },
      },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: {
        vertLine: { color: "rgba(138, 106, 63, 0.4)", width: 1, style: 0, labelBackgroundColor: GOLD_DEEP },
        horzLine: { color: "rgba(138, 106, 63, 0.4)", width: 1, style: 0, labelBackgroundColor: GOLD_DEEP },
      },
      localization: {
        locale: "en-US",
        priceFormatter: (value: number) =>
          `EGP ${Math.round(value).toLocaleString("en-US")}`,
      },
      // A dashboard panel is read, not explored. Scroll and zoom would let an
      // editor drag the series out of frame with a gesture they did not mean.
      handleScroll: false,
      handleScale: false,
    });

    for (const entry of series) {
      const colour = TONES[entry.tone];

      const drawn =
        entry.kind === "area"
          ? chart.addSeries(AreaSeries, {
              lineColor: colour,
              topColor: "rgba(176, 141, 87, 0.24)",
              bottomColor: "rgba(176, 141, 87, 0.02)",
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
            })
          : entry.kind === "histogram"
            ? chart.addSeries(HistogramSeries, {
                color: colour,
                priceLineVisible: false,
                lastValueVisible: false,
              })
            : chart.addSeries(LineSeries, {
                color: colour,
                lineWidth: 2,
                priceLineVisible: false,
                lastValueVisible: false,
              });

      drawn.setData(
        entry.points.map((point) =>
          point.value === null
            ? // Whitespace: the time exists, the value does not. The line breaks
              // rather than diving to the axis.
              { time: point.time as unknown as UTCTimestamp }
            : { time: point.time as unknown as UTCTimestamp, value: point.value },
        ),
      );

      // The target belongs to the first series drawn — revenue — because that is
      // the axis it is a target for.
      if (targetValue !== null && targetValue > 0 && entry === series[0]) {
        drawn.createPriceLine({
          price: targetValue,
          color: GOLD_DEEP,
          lineWidth: 1,
          // 2 is `LineStyle.Dashed`. A solid rule would read as another series.
          lineStyle: 2,
          axisLabelVisible: true,
          title: "Target",
        });
      }
    }

    chart.timeScale().fitContent();

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
    };
  }, [series, targetValue, height]);

  return (
    <div ref={containerRef} style={{ height }} className="w-full" aria-hidden="true" />
  );
}
