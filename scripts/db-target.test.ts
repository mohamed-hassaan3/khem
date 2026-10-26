import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmDatabaseTarget,
  isLocalDatabaseHost,
  normalizeDatabaseHost,
} from "./db-target";

const REMOTE_URL = "postgres://user:password@db.example.com:5432/postgres";

test("normalizes bracketed IPv6 loopback before local comparison", () => {
  assert.equal(normalizeDatabaseHost("[::1]"), "::1");
  assert.equal(isLocalDatabaseHost("[::1]"), true);
});

test("recognizes only exact local hostnames", () => {
  assert.equal(isLocalDatabaseHost("localhost"), true);
  assert.equal(isLocalDatabaseHost("127.0.0.1"), true);
  assert.equal(isLocalDatabaseHost("::1"), true);
  assert.equal(isLocalDatabaseHost("localhost.example.com"), false);
  assert.equal(isLocalDatabaseHost("mylocalhost"), false);
});

test("non-TTY remote target refuses without its exact confirmation", async () => {
  await assert.rejects(
    confirmDatabaseTarget(REMOTE_URL, "seed", {
      interactive: false,
      env: {},
      log: () => undefined,
    }),
    /KHEM_SEED_CONFIRM=db\.example\.com/,
  );
});

test("non-TTY remote target refuses a mismatched confirmation", async () => {
  await assert.rejects(
    confirmDatabaseTarget(REMOTE_URL, "seed", {
      interactive: false,
      env: { KHEM_SEED_CONFIRM: "other.example.com" },
      log: () => undefined,
    }),
    /KHEM_SEED_CONFIRM=db\.example\.com/,
  );
});

test("non-TTY remote target accepts its exact confirmation", async () => {
  await assert.doesNotReject(
    confirmDatabaseTarget(REMOTE_URL, "migrate", {
      interactive: false,
      env: { KHEM_MIGRATE_CONFIRM: "db.example.com" },
      log: () => undefined,
    }),
  );
});

test("local target passes without a confirmation", async () => {
  await assert.doesNotReject(
    confirmDatabaseTarget("postgres://user:password@[::1]:5432/postgres", "seed", {
      interactive: false,
      env: {},
      log: () => undefined,
    }),
  );
});

test("TTY remote target can be confirmed through an injected prompt", async () => {
  await assert.doesNotReject(
    confirmDatabaseTarget(REMOTE_URL, "seed", {
      interactive: true,
      confirmInteractive: async (host) => host,
      env: {},
      log: () => undefined,
    }),
  );
});

test("TTY remote target rejects a mismatched typed host", async () => {
  await assert.rejects(
    confirmDatabaseTarget(REMOTE_URL, "seed", {
      interactive: true,
      confirmInteractive: async () => "other.example.com",
      env: { KHEM_SEED_CONFIRM: "db.example.com" },
      log: () => undefined,
    }),
    /Confirmation did not match db\.example\.com/,
  );
});

test("refuses a URL with a host query parameter", async () => {
  await assert.rejects(
    confirmDatabaseTarget(`${REMOTE_URL}?host=other.example.com`, "seed", {
      interactive: false,
      env: { KHEM_SEED_CONFIRM: "db.example.com" },
      log: () => undefined,
    }),
    /must not contain a host query parameter/,
  );
});
