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
      args: "start --port 3000 --hostname 127.0.0.1",
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
        ...(JEMALLOC ? { LD_PRELOAD: JEMALLOC } : {}),
      },
    },
  ],
};
