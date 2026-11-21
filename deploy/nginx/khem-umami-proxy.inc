# Shared proxy settings for every location that reaches Umami (analytics).
# Included from khemperfumes.conf (the first-party /hk.js and /api/hk) and
# analytics.khemperfumes.conf (the dashboard). Runbook: src/docs/umami-analytics.md
#
# No `proxy_pass` here: each location states its own, because the first-party
# paths are mapped onto different Umami paths (/hk.js → /script.js) and nginx
# allows only one `proxy_pass` per location. The target is always the literal
# http://127.0.0.1:3001 rather than an `upstream` block — the two including
# files load in either order, and neither should depend on the other.

server_tokens off;
proxy_hide_header X-Powered-By;
proxy_http_version 1.1;
proxy_set_header Connection "";

proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;

# The visitor's address, OVERWRITTEN — never appended. Umami reads X-Real-IP
# only (CLIENT_IP_HEADER in deploy/umami/docker-compose.yml) to derive the
# country and the anonymous session hash. X-Forwarded-For is overwritten too,
# on the same rule as khem-proxy.inc.
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;

# Umami also knows these CDN headers. CLIENT_IP_HEADER already stops it reading
# them; blanking them (an empty value is not forwarded) means that stays true
# even if that variable is ever removed.
proxy_set_header True-Client-IP "";
proxy_set_header CF-Connecting-IP "";
proxy_set_header Fastly-Client-IP "";
proxy_set_header X-Client-IP "";
proxy_set_header X-Cluster-Client-IP "";
proxy_set_header Forwarded "";

proxy_read_timeout 30s;
proxy_send_timeout 30s;
