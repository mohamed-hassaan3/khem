import assert from "node:assert/strict";
import test from "node:test";

import {
  formatShopDate,
  formatShopDateTime,
  shopDate,
  shopDayEndUtc,
  shopDayStartUtc,
  shopTodayAsCalendarDate,
  shopWallClockToUtc,
  utcToShopWallClock,
} from "../src/lib/shop-time";

/*
 * Cairo in 2026 (from the tz database, not assumed):
 *   UTC+2 until 2026-04-24 00:00, which jumps to 01:00 (UTC+3);
 *   UTC+3 until 2026-10-29 24:00, which falls back to 23:00 (UTC+2).
 * The tests must pass on a machine in any zone: run with TZ=Europe/Berlin and
 * TZ=UTC as well as the default.
 */

test("winter: Cairo is UTC+2", () => {
  assert.deepEqual(shopWallClockToUtc("2026-11-19T17:10"), {
    ok: true,
    iso: "2026-11-19T15:10:00.000Z",
  });
  assert.equal(utcToShopWallClock("2026-11-19T15:10:00.000Z"), "2026-11-19T17:10");
});

test("summer: Cairo is UTC+3", () => {
  assert.deepEqual(shopWallClockToUtc("2026-07-15T10:00"), {
    ok: true,
    iso: "2026-07-15T07:00:00.000Z",
  });
  assert.equal(utcToShopWallClock("2026-07-15T07:00:00.000Z"), "2026-07-15T10:00");
});

test("the hour skipped when summer time begins is refused", () => {
  assert.deepEqual(shopWallClockToUtc("2026-04-24T00:30"), {
    ok: false,
    reason: "nonexistent",
  });
  // Either side of the gap is fine.
  assert.deepEqual(shopWallClockToUtc("2026-04-23T23:59"), {
    ok: true,
    iso: "2026-04-23T21:59:00.000Z",
  });
  assert.deepEqual(shopWallClockToUtc("2026-04-24T01:00"), {
    ok: true,
    iso: "2026-04-23T22:00:00.000Z",
  });
});

test("the repeated hour when summer time ends resolves to its first occurrence", () => {
  assert.deepEqual(shopWallClockToUtc("2026-10-29T23:30"), {
    ok: true,
    iso: "2026-10-29T20:30:00.000Z",
  });
});

test("malformed or impossible readings are invalid", () => {
  assert.deepEqual(shopWallClockToUtc(""), { ok: false, reason: "invalid" });
  assert.deepEqual(shopWallClockToUtc("2026-02-31T10:00"), { ok: false, reason: "invalid" });
  assert.deepEqual(shopWallClockToUtc("2026-11-19T25:00"), { ok: false, reason: "invalid" });
  assert.deepEqual(shopWallClockToUtc("2026-11-19T15:10:00.000Z"), {
    ok: false,
    reason: "invalid",
  });
});

test("Cairo calendar date of an instant", () => {
  // 23:30 UTC on the 18th is 01:30 on the 19th in Cairo.
  assert.equal(shopDate("2026-11-18T23:30:00.000Z"), "2026-11-19");
  assert.equal(shopDate("2026-11-18T21:59:00.000Z"), "2026-11-18");
  assert.equal(
    shopTodayAsCalendarDate(Date.parse("2026-11-18T23:30:00.000Z")).toISOString(),
    "2026-11-19T00:00:00.000Z",
  );
});

test("a Cairo day runs from Cairo midnight to Cairo midnight", () => {
  assert.equal(shopDayStartUtc("2026-11-19"), "2026-11-18T22:00:00.000Z");
  assert.equal(shopDayEndUtc("2026-11-19"), "2026-11-19T21:59:59.999Z");
  assert.equal(shopDayStartUtc("2026-07-15"), "2026-07-14T21:00:00.000Z");
  // Midnight does not exist on 24 April; the day starts at the jump.
  assert.equal(shopDayStartUtc("2026-04-24"), "2026-04-23T22:00:00.000Z");
  assert.equal(shopDayEndUtc("2026-04-23"), "2026-04-23T21:59:59.999Z");
  // 29 October is 25 hours long.
  assert.equal(shopDayStartUtc("2026-10-29"), "2026-10-28T21:00:00.000Z");
  assert.equal(shopDayEndUtc("2026-10-29"), "2026-10-29T21:59:59.999Z");
  assert.equal(shopDayStartUtc("nonsense"), null);
});

test("display says Cairo and uses Cairo time", () => {
  assert.equal(formatShopDateTime("2026-11-19T08:00:00.000Z"), "19 Nov 2026, 10:00 Cairo");
  assert.equal(
    formatShopDateTime("2026-11-19T08:00:00.000Z", { month: "long" }),
    "19 November 2026 at 10:00 Cairo",
  );
  assert.equal(formatShopDate("2026-11-18T23:30:00.000Z"), "19 Nov 2026");
  assert.equal(formatShopDateTime(null), "—");
});
