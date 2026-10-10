# Running in containers

Kanidm Admin ships a production image and can drive its own ephemeral dev
backend (Kanidm, mail sender, Mailpit) as Docker containers — both through
Docker Compose and when the app itself runs inside a container.

## Docker Compose

```bash
docker compose up -d     # builds the image and serves on port 4000
```

### With the dev testcontainer chain

To run the admin app itself as a container **with the dev testcontainer
chain** (ephemeral Kanidm, mail sender, Mailpit), add the compose override.
It mounts the host Docker socket into the app container and enables
`[testcontainer]`, so the backend drives the same dev chain through the
mounted socket:

```bash
docker compose -f docker-compose.yml -f docker-compose.testcontainers.yml up -d --build
```

The image `docker compose` builds carries the **default** cargo feature
set (customization + testcontainer), so the override above works out of
the box. The slimmer published variants are described in
[Image build check](#image-build-check-pipelight) below.

Inside the container the app talks to the dev chain over Docker DNS names
(`https://kanidm:8443`, `smtps://mailpit:1025`) on the shared
`kanidm-admin-dev` network — no `localhost` ports are involved for the app
itself. The browser-facing ports are still published loopback-only (Kanidm
UI at `https://localhost:4001`, Mailpit UI at `http://localhost:8025`).
`testcontainer.mode = "auto"` detects this automatically (`/.dockerenv`
plus a local socket) and picks `in-container` networking; the plain
variant (`docker compose up`) and the host-mode `cargo run` flow are
unchanged.

> **Note:** mounting `/var/run/docker.sock` gives the container
> root-equivalent access to the host Docker daemon. Only do this for
> a trusted local dev image.

## Dev testcontainers

The dev containers are **opt-in via the configuration**: enable the
`[testcontainer] enabled` master switch (default `false`, settable
per-run as `APP_TESTCONTAINER__ENABLED`; the development settings enable
it) and the backend starts a small chain of Docker containers at startup
instead of using `[kanidm]`. The per-container `enabled` keys select
*which* containers of the chain run:

- **Kanidm** — ephemeral `kanidm/server` container, provisioned with the
  built-in admin credentials (recovered and logged at startup). Its HTTPS
  port is bound to `127.0.0.1` on the fixed
  `testcontainer.kanidm.host_port` (default `4001`) in **both** networking
  modes, so a host browser can open the dev Kanidm UI directly. In host
  mode the URL `https://localhost:4001` matches the certificate SAN;
  in-container mode the SAN is the container DNS name (`kanidm`), so the
  browser shows a certificate warning on the published port — expected for
  the throwaway dev chain.
- **Kanidm mail sender** (`testcontainer.kanidm-mail-sender`) — worker
  container polling Kanidm for outgoing mail and relaying it. No ports are
  published for it.
- **Mailpit** (`testcontainer.mailpit`) — catch-all SMTP server with a web
  UI. The UI is published loopback-only on `mailpit.ui_port` (default
  `8025`) and its URL is printed in the startup log when mailpit runs; the
  SMTP port is bound to `127.0.0.1:1025` for host-mode mail delivery.

All containers share the `testcontainer.network` Docker network (default
`kanidm-admin-dev`); `testcontainer.mode` selects `auto`, `host` or
`in-container` networking. Both browser-facing ports — the Kanidm HTTPS
port and the Mailpit UI — are published loopback-only in either mode; the
mail sender publishes no ports. In host mode the app itself also reaches
the chain over loopback; in-container mode it uses Docker DNS names
instead. Container logs are captured under `logs/testcontainers/`.

The enablement chain is validated at startup: mailpit requires the mail
sender, and the mail sender requires kanidm.

To develop against an existing Kanidm instance instead:

```toml
# app/appsettings.toml (or a local overlay)
[kanidm]
url = "https://idm.example.com"

[testcontainer.kanidm]
enabled = false
```

### Settings

| Setting                                  | Default                       | Description                                     |
| ---------------------------------------- | ----------------------------- | ----------------------------------------------- |
| `testcontainer.enabled`                  | `false` (`true` in dev)       | Master switch for the dev container chain       |
| `testcontainer.mode`                     | `auto`                        | `auto`, `host` or `in-container` networking     |
| `testcontainer.network`                  | `kanidm-admin-dev`            | Shared Docker network                           |
| `testcontainer.kanidm.enabled`           | `false` (`true` in dev)       | Start an ephemeral Kanidm container at startup  |
| `testcontainer.kanidm.image`             | `kanidm/server:1.11.2`        | Image used for the dev Kanidm                   |
| `testcontainer.kanidm.host_port`         | `4001`                        | Fixed loopback HTTPS port for the dev Kanidm    |
| `testcontainer.kanidm-mail-sender.enabled` | `false` (`true` in dev)     | Start the mail sender (requires kanidm)         |
| `testcontainer.kanidm-mail-sender.image` | `kanidm/tools:1.11.2`         | Image used for the mail sender                  |
| `testcontainer.mailpit.enabled`          | `false` (`true` in dev)       | Start Mailpit (requires the mail sender)        |
| `testcontainer.mailpit.image`            | `axllent/mailpit:v1.31.2`     | Image used for Mailpit                          |
| `testcontainer.mailpit.ui_port`          | `8025`                        | Loopback host port for the Mailpit UI           |

The mail sender table accepts both `kanidm-mail-sender` (kebab, natural in
TOML) and `kanidm_mail_sender` (snake, matching the env-override keys).

## Image build check (pipelight)

The production image builds are scripted as
[pipelight](https://pipelight.dev) pipelines (`pipelight.toml` at the repo
root) — one per shipped image variant, mirroring the release workflow's
tags:

```bash
pipelight run docker-build               # kanidm-admin:local            (default: customization + testcontainer)
pipelight run docker-build-customization # kanidm-admin:local-customization (customization only)
pipelight run docker-build-minimal       # kanidm-admin:local-minimal    (no features)
```

The variant is selected through the `CARGO_BUILD_FLAGS` build arg in the
Dockerfile: `""` (default), `--no-default-features --features
customization`, or `--no-default-features`. The default build keeps
`docker compose up -d` and its testcontainers override working; the
customization variant ships the theme variant API without the
container-driver crates; the minimal variant compiles every optional
subsystem out.

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

## Releases

Cut a release by pushing a version tag (or using the *Run workflow* button
on `.github/workflows/release.yml` with a version input):

```bash
git tag v0.1.0 && git push origin v0.1.0
```

The workflow builds **three image variants** — `vX.Y.Z` / `latest`
(default: customization + testcontainer), `vX.Y.Z-customization` /
`latest-customization` (customization only) and `vX.Y.Z-minimal` /
`latest-minimal` (no features) — and creates a GitHub Release whose notes
explain the exact feature set of each tag. The version tags always carry
the `v` prefix, matching the git tag. On a manual *Run workflow* dispatch
a `latest` checkbox (checked by default) controls whether the rolling
`latest*` tags are refreshed; pushing a version tag always refreshes
them. Images are amd64; point the container at your
Kanidm instance by mounting a TOML overlay into `/workspace/app` — there
is no env-var override for `kanidm.url` (see the release notes for the
exact command).
