# Dev-only Kanidm image: the official image plus a shell entrypoint
# that generates TLS material before starting the server.
#
# The official kanidm/server image is FROM scratch (no shell) and the
# server refuses to start without pre-existing TLS files, so a wrapper
# entrypoint is the only single-container way.
#
# Build context: dev/kanidm/ (this file, entrypoint.sh, server.toml).
# The base tag arrives as a build arg from [kanidm_container].image,
# so bumping Kanidm needs no Dockerfile edit.

ARG BASE_IMAGE=kanidm/server:1.11.1

FROM ${BASE_IMAGE} AS kanidm

FROM opensuse/tumbleweed:latest

# Copy only the server binary and the web assets from the official
# image. A whole-root overlay does not work here: current tumbleweed
# is a merged-usr distro where /sbin, /lib and /lib64 are symlinks
# into /usr (and /etc/ssl/certs is a symlink to the CA store), so
# copying the scratch image's real directories over them fails with
# "cannot copy to non-directory".
# kanidmd is statically linked except for glibc core (libc, libm,
# libgcc_s, ld-linux), which the base image already provides as a
# matched set — no LD_LIBRARY_PATH and no bundled libs are needed.
# The base image also ships the same CA store the official image
# bundles, so /etc/ssl/certs needs no copying either.
COPY --from=kanidm /sbin/kanidmd /usr/sbin/kanidmd
COPY --from=kanidm /hpkg/ /hpkg/

# Image config (ENV/EXPOSE/WORKDIR/HEALTHCHECK) is NOT carried over
# by COPY --from, so re-declare what matters. /sbin/kanidmd resolves
# to /usr/sbin/kanidmd through the merged-usr symlink.
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
