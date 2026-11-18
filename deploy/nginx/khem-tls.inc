# TLS settings shared by both HTTPS server blocks.
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:khem_tls:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
# No OCSP stapling: Let's Encrypt retired its OCSP responders in 2025, and
# stapling a certificate with no responder URL only produces warnings.

include /etc/nginx/snippets/khem-hsts.inc;
