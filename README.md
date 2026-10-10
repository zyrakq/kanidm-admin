# Kanidm Admin

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Kanidm](https://img.shields.io/badge/works%20with-Kanidm%201.11-orange)

A modern web-based administration console for
[Kanidm](https://github.com/kanidm/kanidm) — a simple, secure and fast
identity management platform (identity provider) written in Rust.

Kanidm Admin talks to a Kanidm server through its HTTP API and provides a
clean, responsive UI for day-to-day identity administration: people, groups,
service accounts, OAuth2 clients and more.

> **Note:** Kanidm Admin is an independent companion project and is not part
> of the upstream [Kanidm](https://github.com/kanidm/kanidm) codebase. For
> server installation, configuration and general documentation, see the
> official [Kanidm book](https://kanidm.github.io/kanidm/stable/).

## Screenshots

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/login-dark.png">
    <img src="docs/screenshots/login-light.png" alt="Sign-in page">
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/persons-dark.png">
    <img src="docs/screenshots/persons-light.png" alt="Persons list with search, bulk selection and delete">
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/person-detail-dark.png">
    <img src="docs/screenshots/person-detail-light.png" alt="Person details page">
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/groups-dark.png">
    <img src="docs/screenshots/groups-light.png" alt="Groups list">
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/oauth2-dark.png">
    <img src="docs/screenshots/oauth2-light.png" alt="OAuth2 resource servers list">
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/system-dark.png">
    <img src="docs/screenshots/system-light.png" alt="System settings page">
  </picture>
</p>

<p>
  The full set — including light and dark variants of every page, detail
  views and mobile layouts — lives in
  <a href="docs/screenshots/">docs/screenshots/</a>.
</p>

## Features

- **Persons** — search, create, edit and delete people and their attributes
- **Groups** — group management and membership
- **Service Accounts** — manage machine/service identities
- **OAuth2** — configure OAuth2 resource servers and clients
- **Applications, system settings, messages** — further admin sections
- **Sync & recycle bin** — sync state overview and soft-deleted entry recovery
- **Session auth** — password sign-in with session cookies and privilege
  step-up (re-authentication) for sensitive actions
- **Secure proxying** — the Rust backend proxies Kanidm API calls on behalf
  of the authenticated session; no direct browser-to-Kanidm traffic
- **Light & dark themes** — with flash-free theme initialization
- **Internationalization** — English, Russian, Spanish, Simplified Chinese
- **Version compatibility indicator** — footer status dot and banner when the
  connected Kanidm server version drifts outside the supported band
- **Single-binary deployment** — release builds embed the compiled SPA
  (`rust-embed`); production ships one static binary

## Tech Stack

| Layer     | Technology                                        |
| --------- | ------------------------------------------------- |
| Backend   | Rust, Axum, Tokio, tower-http, `kanidm_client`    |
| Frontend  | TypeScript, Lit 3, Vite                           |
| Auth      | Kanidm password login, session cookies, step-up   |

## Requirements

- **Rust** (stable, recent) — backend and release builds
- **Bun** — frontend toolchain for local builds and the dev loop
- **Docker** *(optional)* — for the bundled development Kanidm container and
  the production image

## Quick Start

### Development

```bash
git clone https://github.com/zyrakq/kanidm-admin.git
cd kanidm-admin
cargo run            # server starts at http://localhost:4000
```

In development mode the app can run an **ephemeral Kanidm container**
(`kanidm/server:1.11.2` via Docker), provision it and recover the
built-in admin credentials — no pre-existing Kanidm server needed.
The containers are **opt-in**: they start only when the
`[testcontainer]` master switch is enabled (see
[Dev testcontainers](#dev-testcontainers)).
Frontend source edits trigger a rebuild (`bun watch`) and are served live.

To develop against an existing Kanidm instance instead:

```toml
# app/appsettings.toml (or a local overlay)
[kanidm]
url = "https://idm.example.com"

[testcontainer.kanidm]
enabled = false
```

### Production build

```bash
cargo build --release    # SPA is compiled and embedded into the binary
```

### Docker

```bash
docker compose up -d     # builds the image and serves on port 4000
```

To run the admin app itself as a container **with the dev
testcontainer chain** (ephemeral Kanidm, mail sender, Mailpit), add
the compose override. It mounts the host Docker socket into the app
container and enables `[testcontainer]`, so the backend drives the
same dev chain through the mounted socket:

```bash
docker compose -f docker-compose.yml -f docker-compose.testcontainers.yml up -d --build
```

> **Note:** the shipped image is compiled **without** the testcontainer
> feature (`--no-default-features --features customization`) — see
> [Docker image build check](#docker-image-build-check-pipelight). The
> override above only works with a locally rebuilt image that includes
> the feature; otherwise the app starts without the dev chain.

Inside the container the app talks to the dev chain over Docker DNS
names (`https://kanidm:8443`, `smtps://mailpit:1025`) on the shared
`kanidm-admin-dev` network — no `localhost` ports are involved for
the app itself. The browser-facing ports are still published
loopback-only (Kanidm UI at `https://localhost:4001`, Mailpit UI at
`http://localhost:8025`). `testcontainer.mode = "auto"`
detects this automatically (`/.dockerenv` plus a local socket) and
picks `in-container` networking; the plain variant (`docker compose
up`) and the host-mode `cargo run` flow are unchanged.

> **Note:** mounting `/var/run/docker.sock` gives the container
> root-equivalent access to the host Docker daemon. Only do this for
> a trusted local dev image.

### Docker image build check (pipelight)

The production image build is scripted as a
[pipelight](https://pipelight.dev) pipeline (`pipelight.toml` at the repo
root). It builds the same image `docker compose` runs:

```bash
pipelight run docker-build   # builds kanidm-admin:local
```

The image pins the production feature set in its Dockerfile:
`cargo build --release --no-default-features --features customization` —
the customization API (theme variants) stays in, while the dev-only
testcontainer chain is compiled out, so the image never touches a
Docker socket.

Validate the pipeline definition without building:

```bash
pipelight ls
```

The pipeline is manual-only (no triggers). To run it automatically on
`git push`, opt in with pipelight's git hooks:

```bash
pipelight enable git-hooks
```

The same pipeline runs in CI on every push/PR to `master`
(`.github/workflows/pipelight.yml`).

### Releases

Cut a release by pushing a version tag (or using the *Run workflow* button
on `.github/workflows/release.yml` with a version input):

```bash
git tag v0.1.0 && git push origin v0.1.0
```

The workflow builds the image, pushes `ghcr.io/zyrakq/kanidm-admin:X.Y.Z`
and `:latest`, and creates a GitHub Release with pull/run instructions.
The image is compiled with `--no-default-features --features customization`
(customization in, dev testcontainer chain out) — the release notes state
the exact feature set. Images are amd64; point the container at your
Kanidm instance by mounting a TOML overlay into `/workspace/app` — there
is no env-var override for `kanidm.url` (see the release notes for the
exact command).

## Configuration

Settings are layered TOML files: `app/appsettings.toml` (base), then
`app/appsettings.{APP_ENV}.toml` (`APP_ENV` defaults to `development`).

| Setting                 | Default                        | Description                                     |
| ----------------------- | ------------------------------ | ----------------------------------------------- |
| `server.address`        | `0.0.0.0:4000`                 | HTTP bind address                               |
| `frontend.serve_from`   | `disk` (dev) / `embedded` (prod) | Serve the SPA from disk or the embedded assets |
| `frontend.watch`        | `false`                        | `bun watch` live rebuild (development)          |
| `kanidm.url`            | `https://localhost:8443`       | Kanidm server URL                               |
| `testcontainer.enabled` | `false` (`true` in dev)  | Master switch for the dev container chain       |
| `testcontainer.kanidm.enabled` | `false` (`true` in dev) | Start an ephemeral Kanidm container at startup  |
| `testcontainer.kanidm.image`   | `kanidm/server:1.11.2` | Image used for the dev container                |
| `testcontainer.kanidm.host_port` | `4001`               | Fixed loopback HTTPS port for the dev Kanidm    |
| `customization.dir`     | `""` (`<manifest_dir>/customization/`) | Directory for uploaded customization files     |
| `customization.max_size_bytes` | `524288`                        | Max upload size per file                       |
| `customization.theme.light` | `""`                               | Deployment-default light theme variant file name |
| `customization.theme.dark`  | `""`                               | Deployment-default dark theme variant file name  |

### Theme variants

Theme overrides are ordinary `.css` files in per-mode subfolders of
the customization dir: `themes/light/` and `themes/dark/` (default
`app/customization/themes/light|dark/`). Files mounted into a mode's
folder appear automatically in that mode's dropdown on the
customization page; the folders are separate namespaces, so the same
file name may exist in both (its `:root` / `:root[theme='dark']`
selectors decide what it affects). The active variant per mode
resolves as: a selection made on the customization page → the
deployment default set via `[customization.theme]` (env:
`APP_CUSTOMIZATION__THEME__LIGHT` / `APP_CUSTOMIZATION__THEME__DARK`,
file name only — the folder is implied) → the built-in default (no
override stylesheet). Legacy `theme-light` / `theme-dark` files in the
customization root are migrated into `themes/light/theme-light.css` /
`themes/dark/theme-dark.css` at startup.

## Dev testcontainers

The dev containers are **opt-in via the configuration**: enable
the `[testcontainer] enabled` master switch (default `false`,
settable per-run as `APP_TESTCONTAINER__ENABLED`) and the backend
starts a small chain of Docker containers at startup instead of
using `[kanidm]`. The per-container `enabled` keys select *which*
containers of the chain run:

- **Kanidm** — ephemeral `kanidm/server` container, provisioned with
  the built-in admin credentials (recovered and logged at startup).
  Its HTTPS port is bound to `127.0.0.1` on the fixed
  `testcontainer.kanidm.host_port` (default `4001`) in **both**
  networking modes, so a host browser can open the dev Kanidm UI
  directly. In host mode the URL `https://localhost:4001` matches
  the certificate SAN; in-container mode the SAN is the container
  DNS name (`kanidm`), so the browser shows a certificate warning
  on the published port — expected for the throwaway dev chain.
- **Kanidm mail sender** (`testcontainer.kanidm-mail-sender`) —
  worker container polling Kanidm for outgoing mail and relaying it.
  No ports are published for it.
- **Mailpit** (`testcontainer.mailpit`) — catch-all SMTP server with
  a web UI. The UI is published loopback-only on `mailpit.ui_port`
  (default `8025`) and its URL is printed in the startup log when
  mailpit runs; the SMTP port is bound to `127.0.0.1:1025` for
  host-mode mail delivery.

All containers share the `testcontainer.network` Docker network
(default `kanidm-admin-dev`); `testcontainer.mode` selects `auto`,
`host` or `in-container` networking. Both browser-facing ports —
the Kanidm HTTPS port and the Mailpit UI — are published
loopback-only in either mode; the mail sender publishes no ports.
In host mode the app itself also reaches the chain over loopback;
in-container mode it uses Docker DNS names instead. Container
logs are captured under `logs/testcontainers/`.

The same chain also runs when the admin app itself is a container:
the [compose override](#docker) mounts the Docker socket and the app
switches to `in-container` networking, reaching the containers via
Docker DNS names instead of loopback ports.

To develop against an existing Kanidm instance instead:

```toml
# app/appsettings.toml (or a local overlay)
[kanidm]
url = "https://idm.example.com"

[testcontainer.kanidm]
enabled = false
```

## Kanidm Compatibility

Kanidm Admin targets Kanidm **1.11.x** (the `kanidm_client` version pinned in
`Cargo.toml`). Compatibility is a declared band around that pinned version —
same major, minor within ±1. When the connected server drifts outside the
band, the UI shows an amber or red banner and footer indicator; it stays
usable either way.

## Related Projects

- [Kanidm](https://github.com/kanidm/kanidm) — the identity provider this
  tool administers
- [Kanidm book](https://kanidm.github.io/kanidm/stable/) — official server
  documentation

## License

Distributed under the [MIT License](LICENSE).
Kanidm itself is licensed under the
[MPL-2.0](https://github.com/kanidm/kanidm/blob/master/LICENSE.md).
