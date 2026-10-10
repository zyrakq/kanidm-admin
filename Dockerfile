# The image ships one binary; the cargo feature set is selected through the
# CARGO_BUILD_FLAGS build arg so the same Dockerfile produces three variants:
#   ""                                          -> default: customization + testcontainer
#   "--no-default-features --features customization" -> customization only
#   "--no-default-features"                     -> minimal (no features)
# The default (no build arg) matches `cargo build --release` and keeps
# `docker compose up -d` and its testcontainers override fully working.
ARG CARGO_BUILD_FLAGS=""

###############################################################################
# Stage 1 — Frontend (Bun)
###############################################################################
FROM oven/bun:1-debian AS frontend-builder

WORKDIR /build

# Install deps in a dedicated layer — invalidated only when lockfile changes
COPY app/ui/package.json app/ui/bun.lock ./
RUN bun install --frozen-lockfile

COPY app/ui/ ./
RUN bun run build

###############################################################################
# Stage 2 — Rust backend
###############################################################################
FROM rust:1-bookworm AS rust-builder

# No system packages are required: the dependency graph (axum, tokio,
# tower-http, serde, tracing, config, dotenvy, rust-embed) is 100% pure-Rust
# with no OpenSSL/cmake/clang linkage and no git dependencies.

# build.rs is a fast no-op in this stage: bun and ui sources are absent,
# the prebuilt dist from stage 1 is embedded by rust-embed instead.
ENV APP_SKIP_FRONTEND_BUILD=1

# CARGO_BUILD_FLAGS is re-declared inside the stage (ARGs declared before
# the first FROM are not inherited automatically) and pins the feature set
# for both cargo invocations below.
ARG CARGO_BUILD_FLAGS=""

# ── Dependency cache layer ────────────────────────────────────────────────
# Compile all dependencies using a stub binary.
# This layer is invalidated only when Cargo.lock changes, not on src edits.
# build.rs is intentionally NOT copied here yet — the stub build does not
# need it, and its absence keeps this layer independent of build script
# edits.
#
# The stub layer must use the exact same CARGO_BUILD_FLAGS as the real
# build below or its cache is useless (feature flags change the compiled
# dependency set). `|| true` keeps the stub layer valid even before app/
# sources exist.
WORKDIR /workspace

COPY Cargo.toml Cargo.lock ./
COPY app/Cargo.toml ./app/
RUN mkdir -p app/src && printf 'fn main() {}' > app/src/main.rs
RUN cargo build --release ${CARGO_BUILD_FLAGS} || true

# ── Real build ────────────────────────────────────────────────────────────────
COPY app/build.rs                      ./app/
COPY app/src/                          ./app/src/
COPY app/appsettings.toml              ./app/
COPY app/appsettings.production.toml   ./app/

# Prebuilt SPA assets from stage 1 — rust-embed inlines them into the
# release binary at compile time.
COPY --from=frontend-builder /build/dist ./app/ui/dist

RUN touch app/src/main.rs && cargo build --release ${CARGO_BUILD_FLAGS}

###############################################################################
# Stage 3 — Runtime (slim)
###############################################################################
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# CARGO_MANIFEST_DIR = /workspace/app is compiled into the binary at build time.
# Settings::load() reads appsettings from this path.
WORKDIR /workspace/app

# ── Binary (frontend assets are embedded — no dist directory needed) ──────
COPY --from=rust-builder /workspace/target/release/kanidm-admin /usr/local/bin/kanidm-admin

# ── Layered config ────────────────────────────────────────────────────────────
# Settings::load() reads appsettings.toml then appsettings.<APP_ENV>.toml
# from CARGO_MANIFEST_DIR = /workspace/app. appsettings.docker.toml backs
# the compose testcontainers override (APP_ENV=docker).
COPY app/appsettings.toml            ./
COPY app/appsettings.production.toml ./
COPY app/appsettings.docker.toml     ./

EXPOSE 4000

ENV APP_ENV=production

CMD ["kanidm-admin"]
