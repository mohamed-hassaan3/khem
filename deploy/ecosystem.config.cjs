/**
 * PM2 process definition for the KHEM VPS.
 *
 * One process, fork mode — deliberately. On-demand revalidation
 * (`src/lib/admin/revalidate.ts`) clears the cache of the process that ran the
 * admin action; with two processes the other would keep serving stale pages
 * until its own timer lapsed. One `next start` on 2 vCPU is ample at this
 * traffic. A second instance needs a shared `cacheHandler` first.
 *
 * Environment: `next start` loads `.env.production` from its working
 * directory, which `deploy.sh` symlinks to `/srv/khem/shared/.env.production`.
 * Only process-level settings live here.
 */

// PM2 loads this file as CommonJS, so `require` is the only import available.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("node:fs");

// glibc's allocator fragments under sharp's image work; jemalloc keeps the
// resident size flat (Next.js self-hosting guide, "Image Optimization").
const JEMALLOC = [
  "/usr/lib/x86_64-linux-gnu/libjemalloc.so.2",
  "/usr/lib/aarch64-linux-gnu/libjemalloc.so.2",
].find((candidate) => fs.existsSync(candidate));

module.exports = {
  apps: [
    {
      name: "khem",
      cwd: "/srv/khem/current",
      script: "node_modules/next/dist/bin/next",
      // `localhost`, not `127.0.0.1`. Next builds its own base URL from this
      // value, while `request.nextUrl` (what src/proxy.ts rewrites) always
      // spells loopback as `localhost`. With `127.0.0.1` the two origins differ,
      // so every locale rewrite was treated as *external* and proxied over HTTP
      // to `localhost` — which resolves to ::1 here, where nothing listens:
      // every page hung for 30 s and returned 500. With `localhost` they match
      // and rewrites stay internal. NODE_OPTIONS below makes `localhost`
      // resolve to 127.0.0.1, so the bind stays loopback-only and IPv4.
      args: "start --port 3000 --hostname localhost",
      exec_mode: "fork",
      instances: 1,
      // SIGTERM, then up to 30 s for in-flight requests and pending `after()`
      // callbacks (order emails, revalidation) before PM2 kills the process.
      kill_timeout: 30000,
      max_memory_restart: "1500M",
      autorestart: true,
      min_uptime: "20s",
      max_restarts: 10,
      out_file: "/srv/khem/logs/app.out.log",
      error_file: "/srv/khem/logs/app.err.log",
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        // IPv4 first for every lookup: binds `localhost` to 127.0.0.1 (above),
        // and keeps outbound calls (Supabase, Clerk, Resend, the AI Gateway) off
        // this VPS's IPv6 route, which has an address but no connectivity.
        NODE_OPTIONS: "--dns-result-order=ipv4first",
        ...(JEMALLOC ? { LD_PRELOAD: JEMALLOC } : {}),
      },
    },
  ],
};
