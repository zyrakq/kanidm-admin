# Dev-only Kanidm image: the official image plus a shell entrypoint
# that generates TLS material before starting the server.
#
# The official kanidm/server image is FROM scratch (no shell) and the
# server refuses to start without pre-existing TLS files, so a wrapper
# entrypoint is the only single-container way. The official image is
# itself built on opensuse/tumbleweed, so overlaying its content onto
# a current tumbleweed keeps the dynamically linked /sbin/kanidmd
# working (its bundled libs land in /lib and /lib64).
#
# Build context: dev/kanidm/ (this file, entrypoint.sh, server.toml).
# The base tag arrives as a build arg from [kanidm_container].image,
# so bumping Kanidm needs no Dockerfile edit.

ARG BASE_IMAGE=kanidm/server:1.11.1

FROM ${BASE_IMAGE} AS kanidm

FROM opensuse/tumbleweed:latest

# Overlay the official image content: /sbin/kanidmd, bundled libs in
# /lib and /lib64, web assets in /hpkg, CA certs. Copying the whole
# root avoids per-path existence assumptions (COPY fails on missing
# source paths).
# Fallback if the current tumbleweed userland breaks against the
# image-era bundled libs: copy only /sbin, /hpkg and /etc/ssl/certs,
# then resolve any missing shared libs via zypper.
COPY --from=kanidm / /

# Image config (ENV/EXPOSE/WORKDIR/HEALTHCHECK) is NOT carried over
# by COPY --from, so re-declare what matters. LD_LIBRARY_PATH is
# required for kanidmd to find its bundled libs in /lib (see the
# official image's Dockerfile).
ENV LD_LIBRARY_PATH=/lib
ENV RUST_BACKTRACE=1

HEALTHCHECK \
    --interval=30s \
    --timeout=5s \
    --start-period=30s \
    --retries=5 \
    CMD [ "/sbin/kanidmd", "scripting", "healthcheck" ]

COPY server.toml /data/server.toml
COPY --chmod=0755 entrypoint.sh /entrypoint.sh

EXPOSE 8443 3636
WORKDIR /data

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]
