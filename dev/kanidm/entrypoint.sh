#!/bin/bash
# Dev-only Kanidm entrypoint.
#
# The server refuses to start without TLS files. `kanidmd
# cert-generate` writes ca.pem/cakey.pem/cert.pem/key.pem next to the
# configured tls_key (/data) and refuses to overwrite existing files,
# so this is idempotent — and /data is fresh on every ephemeral
# container start anyway. The config path defaults to /data/server.toml
# (compiled into the container-profile binary), so no -c is needed.
set -euo pipefail

if [[ ! -f /data/key.pem || ! -f /data/cert.pem ]]; then
    /sbin/kanidmd cert-generate
fi

exec /sbin/kanidmd server
