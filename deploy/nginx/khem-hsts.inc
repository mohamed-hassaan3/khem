# HSTS — HTTPS responses only (never included from a port-80 block).
#
# Lives here rather than in next.config.ts: it describes the certificate, and
# the certificate is nginx's. No `preload`, so the decision stays reversible.
#
# nginx drops inherited add_header directives in any block that declares its
# own, so every location that adds a header includes this file again.
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
