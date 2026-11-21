import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  UMAMI_DOMAIN,
  beforeSend,
  shouldLoadUmami,
  shouldSendPath,
} from "../src/lib/analytics/umami";
import {
  ACCEPT_ALL,
  DECLINE_ALL,
  toConsentRecord,
  type ConsentRecord,
} from "../src/lib/consent";

/*
 * Umami — what may be reported, and that loading never waits on consent
 * (prompts/umami-count-every-visitor.md).
 *
 *   npx tsx --test scripts/umami-analytics.test.ts
 */

test("the page filter: public pages pass, private ones never leave", () => {
  const cases: ReadonlyArray<readonly [unknown, boolean]> = [
    ["https://khemperfumes.com/", true],
    ["https://khemperfumes.com/perfume/amun", true],
    ["https://khemperfumes.com/ar/journal/x", true],
    ["https://khemperfumes.com/admin", false],
    ["https://khemperfumes.com/ar/admin/orders/KHEM-2026-1", false],
    ["/account/orders", false],
    ["/ar/account", false],
    ["https://khemperfumes.com/unsubscribe?token=abc", false],
    ["/sign-in/factor-one", false],
    // Prefixes match whole segments only.
    ["https://khemperfumes.com/administrator-notes", true],
    ["https://khemperfumes.com/accounts", true],
    // Anything unvetted is refused.
    ["", false],
    [undefined, false],
    [42, false],
  ];

  assert.equal(cases.length, 14);
  for (const [input, expected] of cases) {
    assert.equal(shouldSendPath(input), expected, String(input));
  }
});

test("checkout is counted — it is the last step of the funnel", () => {
  assert.equal(shouldSendPath("https://khemperfumes.com/checkout"), true);
  assert.equal(shouldSendPath("/ar/checkout"), true);
});

test("only the production hostname records", () => {
  assert.equal(UMAMI_DOMAIN, "khemperfumes.com");
});

test("beforeSend drops an excluded page", () => {
  assert.equal(
    beforeSend("event", { url: "https://khemperfumes.com/admin/orders" }),
    null,
  );
  assert.equal(beforeSend("event", {}), null);
});

test("beforeSend blanks an excluded referrer and keeps the page view", () => {
  const sent = beforeSend("event", {
    url: "https://khemperfumes.com/",
    referrer: "/ar/admin/customers/42",
  });
  assert.deepEqual(sent, { url: "https://khemperfumes.com/", referrer: "" });
});

test("beforeSend passes a public page unchanged", () => {
  const payload = {
    url: "https://khemperfumes.com/perfume/amun",
    referrer: "https://www.google.com/",
    title: "Amun",
  };
  assert.equal(beforeSend("event", payload), payload);
});

test("the tracker loads before any answer, after Decline and after Accept", () => {
  const states: ReadonlyArray<readonly [string, ConsentRecord | null]> = [
    ["no answer yet", null],
    ["declined", toConsentRecord(DECLINE_ALL)],
    ["accepted", toConsentRecord(ACCEPT_ALL)],
  ];

  /*
   * The load decision takes no consent input at all — that is the contract.
   * The arity check fails the moment someone threads a consent argument back
   * in; the loop states the behaviour for each answer the banner can hold.
   */
  assert.equal(shouldLoadUmami.length, 0);

  const prior = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  try {
    process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID =
      "00000000-0000-0000-0000-000000000000";
    for (const [label] of states) {
      assert.equal(shouldLoadUmami(), true, `configured, ${label}`);
    }

    // Unconfigured is the only thing that stops it — for every state alike.
    process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = "";
    for (const [label] of states) {
      assert.equal(shouldLoadUmami(), false, `unconfigured, ${label}`);
    }
  } finally {
    if (prior === undefined) delete process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
    else process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = prior;
  }
});

test("UmamiAnalytics never reads the cookie consent", () => {
  const source = readFileSync(
    path.join(process.cwd(), "src/components/analytics/UmamiAnalytics.tsx"),
    "utf8",
  );
  // Comments may talk about consent; code must not import or call it.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  assert.doesNotMatch(code, /consent-provider/);
  assert.doesNotMatch(code, /useConsent\s*\(/);
  assert.doesNotMatch(code, /record\??\.analytics/);
  assert.match(code, /shouldLoadUmami\(\)/);
});
