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

## Documentation

- [Customization](docs/customization.md) — logo/favicon overrides and
  light/dark theme variants
- [Running in containers](docs/containers.md) — Docker Compose, the dev
  testcontainer chain, image build variants and releases

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
[Running in containers](docs/containers.md#dev-testcontainers)).
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

Running the app itself as a container — with or without the dev
testcontainer chain — plus image build variants and releases are
covered in [Running in containers](docs/containers.md).

## Configuration

Settings are layered TOML files: `app/appsettings.toml` (base), then
`app/appsettings.{APP_ENV}.toml` (`APP_ENV` defaults to `development`).

| Setting                 | Default                        | Description                                     |
| ----------------------- | ------------------------------ | ----------------------------------------------- |
| `server.address`        | `0.0.0.0:4000`                 | HTTP bind address                               |
| `frontend.serve_from`   | `disk` (dev) / `embedded` (prod) | Serve the SPA from disk or the embedded assets |
| `frontend.watch`        | `false`                        | `bun watch` live rebuild (development)          |
| `kanidm.url`            | `https://localhost:8443`       | Kanidm server URL                               |

The `testcontainer.*` settings are documented in
[Running in containers](docs/containers.md#settings), the
`customization.*` settings in
[Customization](docs/customization.md#configuration).

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
