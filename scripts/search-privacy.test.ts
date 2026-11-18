import assert from "node:assert/strict";
import test from "node:test";

import { isAutomatedAgent, looksPersonal } from "../src/lib/search/privacy";

test("email-shaped queries are personal", () => {
  assert.equal(looksPersonal("my email a@b.com"), true);
  assert.equal(looksPersonal("name.surname@example.co.uk"), true);
});

test("long digit runs are personal, however they are punctuated", () => {
  assert.equal(looksPersonal("01012345678"), true);
  assert.equal(looksPersonal("+20 101 234 5678"), true);
  assert.equal(looksPersonal("(010) 123-45-678"), true);
  assert.equal(looksPersonal("٠١٠١٢٣٤٥٦٧٨"), true); // Arabic-Indic digits
  assert.equal(looksPersonal("4111 1111 1111 1111"), true);
  // An order number points at one customer's order, so it is not logged either.
  assert.equal(looksPersonal("KHEM-2026-8921"), true);
});

test("ordinary searches are not personal", () => {
  for (const query of ["oud", "عود", "100 ml", "1001 nights", "noir 2026", "rose & oud"]) {
    assert.equal(looksPersonal(query), false, query);
  }
});

test("automated agents are recognised; browsers are not", () => {
  assert.equal(isAutomatedAgent(null), true);
  assert.equal(isAutomatedAgent("curl/8.7.1"), true);
  assert.equal(isAutomatedAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(isAutomatedAgent("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120"), true);
  assert.equal(
    isAutomatedAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    ),
    false,
  );
  assert.equal(
    isAutomatedAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    ),
    false,
  );
});
