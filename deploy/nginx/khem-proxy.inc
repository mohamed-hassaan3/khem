# Shared proxy settings for every location that reaches Next.js.
# Included from khemperfumes.conf and khemperfumes.bootstrap.conf.

proxy_pass http://khem_next;
proxy_http_version 1.1;
proxy_set_header Connection "";

proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;

# OVERWRITE, never append. The search and email rate limits key on the leftmost
# X-Forwarded-For entry (src/app/api/search/route.ts, src/lib/email/rate-limit.ts);
# `$proxy_add_x_forwarded_for` would let a client choose it.
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Real-IP $remote_addr;

# Visitor country (src/lib/geo.ts). Always overwritten, so a client can never
# supply it. Empty = unknown → the browser-timezone fallback picks the currency.
# To enable GeoIP later: install libnginx-mod-http-geoip2 + geoipupdate, define
# `$geoip2_country_code` in conf.d, and replace "" with $geoip2_country_code.
proxy_set_header x-khem-country "";

# Streaming (React Server Components, Suspense) must not be buffered.
proxy_buffering off;
proxy_read_timeout 120s;
proxy_send_timeout 120s;
