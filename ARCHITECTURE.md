# Architecture

## Overview

**kanidm-admin** is a full-stack web application for administering a
[Kanidm](https://github.com/kanidm/kanidm) identity provider. It consists of
a thin Rust/Axum backend and a TypeScript/Lit SPA frontend.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Rust, Axum 0.8, Tokio, tower-http |
| Frontend | TypeScript, Lit 3, Vite 7, `@lit/localize`, `@lit-labs/router` |
| Package manager | Bun |
| Auth | Stubbed (disabled) — pending a future Kanidm OIDC integration design |

## Directory Structure

```
kanidm-admin/
├── app/
│   ├── src/
│   │   ├── main.rs          # Entry point — thin orchestration only
│   │   ├── settings.rs      # Layered TOML config loading
│   │   ├── frontend.rs      # Frontend build and watch helpers
│   │   ├── preflight.rs     # CLI dependency checks (e.g. `bun`)
│   │   ├── logging.rs       # Tracing/env_logger init
│   │   └── routes.rs        # Custom API handlers and router
│   ├── Cargo.toml           # Rust package manifest
│   ├── .env                 # Local environment variables
│   └── ui/                  # TypeScript SPA
│       ├── index.html       # HTML entry point
│       ├── src/
│       │   ├── app-component.ts   # Root Lit component (<app-component>)
│       │   ├── index.css          # Global CSS entry point
│       │   ├── assets/            # SVG logos (light/dark)
│       │   ├── features/          # Feature modules (self-contained)
│       │   │   ├── auth/          # Authentication (stubbed, pending real OIDC design)
│       │   │   ├── theme/         # Light/dark theme switching
│       │   │   ├── localization/  # i18n (en, ru, es, zh-Hans)
│       │   │   └── notifications/ # Toast + modal notifications
│       │   ├── pages/             # Top-level page components
│       │   │   ├── dashboard-page.ts
│       │   │   └── welcome-page.ts
│       │   └── shared/            # Reusable UI components
│       │       └── components/
│       │           ├── app-header.ts
│       │           └── footer-info.ts
│       ├── xliff/           # Translation source files (ru, es, zh-Hans)
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── lit-localize.json
│       └── package.json
├── vendor/
│   └── kanidm/               # Vendored upstream Kanidm source — read-only reference
├── Cargo.toml               # Workspace manifest
└── .justfile                # Task runner recipes
```

## Vendored Reference

`vendor/kanidm/` is a vendored copy (not a git submodule) of the upstream
[Kanidm](https://github.com/kanidm/kanidm) identity provider — the actual
server that kanidm-admin administers.

- **Read-only.** Never edit, format, or lint files under `vendor/kanidm/`.
- **Not a workspace member.** It is not listed in the root `Cargo.toml`
  `[workspace] members`, and no crate under `app/` imports from it directly.
- **Purpose.** It is the authoritative source for Kanidm's HTTP/OIDC API
  contracts, data models, and behavior — consult it when implementing
  kanidm-admin features that talk to a real Kanidm instance (most notably
  the future real auth integration, see Open Questions below).
- **Updates.** Refreshed by re-copying from upstream when needed; changes
  are never hand-authored in place.

## Core Components

### Backend (`app/src/`)

Modular Axum server. `main.rs` is thin orchestration — business logic lives
in dedicated modules:

| Module | Responsibility |
|---|---|
| `main.rs` | Bootstrap, load config, wire modules, start server |
| `settings.rs` | Layered TOML configuration (`Settings::load()`) |
| `frontend.rs` | Frontend build (`bun run build`) and watch (`bun watch`) |
| `preflight.rs` | CLI dependency checks (currently: `bun`) |
| `logging.rs` | Tracing filter + `pretty_env_logger` init |
| `routes.rs` | Custom API handlers and router assembly |

`main.rs` sequence:

1. Load `.env` (dotenvy), init tracing
2. Load settings (`Settings::load()`)
3. Optionally build frontend (`frontend::build`) / spawn watch (`frontend::spawn_watch`)
4. Bind a `TcpListener` on `settings.server.address`
5. Merge routers: `routes::build()` → SPA static-file fallback
6. Serve via `axum::serve`

### Frontend Features

Each feature is self-contained under `src/features/<name>/` with this structure:

```
<feature>/
├── components/   # Lit web components
├── services/     # Business logic, singletons
├── types/        # TypeScript interfaces
└── index.ts      # Public API (only export from here)
```

#### `auth` (stubbed)

- **`AuthService`** — app-level state manager; currently stubbed to always
  report unauthenticated with **no network calls**, pending a future design
  for real Kanidm OIDC integration
- **`<auth-status>`** — login card; the "Sign In" action is disabled
  ("coming soon") until real auth is implemented
- **`<oauth-callback>`** — handles the `/auth/callback` route; currently
  unreachable dead-end UI (nothing links to it while sign-in is disabled),
  retained for the future auth integration

#### `theme`

- **`ThemeService`** — reads/writes `localStorage['kanidm-theme']`; sets `document.documentElement[theme]` attribute; notifies subscribers
- **`ThemeController`** — Lit Reactive Controller; subscribes to `ThemeService`, calls `host.requestUpdate()` on change
- **`<theme-toggler>`** — toggle button (moon/sun icons)
- **`FaviconService`** — syncs `<link>` favicon elements with current theme
- **`preventFART()`** — inline script injected in `<head>` to set theme before first paint

#### `localization`

- **`LocalizationService`** — wraps `@lit/localize`; dynamically imports locale modules; persists to `localStorage['kanidm-locale']`; cross-tab sync via `storage` event
- **`LocaleController`** — Lit Reactive Controller; listens to `lit-localize-status` on `window`, triggers re-render
- **`localized()` decorator** — auto-wires `LocaleController` into any component's `connectedCallback`
- **`<locale-switcher>`** — dropdown for selecting locale
- **`generated/locales/`** — auto-generated locale modules (do not edit manually)

#### `notifications`

- **`NotificationService`** — fires `CustomEvent('notification-add')` on `window`; no internal state
- **`<toast-container>`** — manages toast lifecycle: queuing (max 4 visible), rAF-based opacity fade, pause on hover/modal, slide-out animation
- **`<toast-notification>`** — single toast item; truncates messages > 150 chars, opens modal on click
- **`<notification-modal>`** — full-screen overlay for long messages; pauses all toast timers

### Shared Components

- **`<app-header>`** — logo, app name, `<theme-toggler>`, `<locale-switcher>`; hides app name at ≤540px
- **`<footer-info>`** — status dot, version `v0.0.0`, external links (GitHub, Kanidm docs)

## Data Flow

### Authentication Flow (stubbed)

```
User visits /
  → <auth-status> mounts → authService.init()
    → no network call; authState stays { isAuthenticated: false, user: null }
  → renders a disabled "Sign In (coming soon)" button
```

Real Kanidm OIDC integration (login redirect, callback handling, session
refresh) is deferred to a follow-up design. `vendor/kanidm` is the reference
for that work's API contracts.

### Notification Event Bus

```
notificationService.success(msg)
  → window: 'notification-add'
    → <toast-container> queues toast, starts rAF fade timer

toast mouseenter → 'toast-pause' → pauseTimer (cancels rAF)
toast mouseleave → 'toast-resume' → resumeTimer (restarts rAF)
toast click (long msg) → window: 'open-notification-modal'
  → modal.open() → window: 'modal-opened' → pause all timers
modal close() → window: 'modal-closed' → resume all timers
```

### Theme Flow

```
ThemeService.init()
  → reads localStorage['kanidm-theme'] or matchMedia
  → document.documentElement.setAttribute('theme', value)
  → notifies all subscribers (ThemeController instances, ThemeToggler, FaviconService)

ThemeController (in any component)
  → subscribes to ThemeService
  → on change: host.requestUpdate() → component re-renders
```

## External Integrations

| Service | Integration |
|---|---|
| Kanidm | Identity provider administered by this app — no live API integration yet (auth stubbed) |
| GitHub | External links in footer |

## Configuration

| File | Purpose |
|---|---|
| `app/.env` | Local env vars (e.g., `PUBLIC_DIR`) |
| `app/ui/vite.config.ts` | Path aliases, build options |
| `app/ui/tsconfig.json` | TypeScript strict mode, path mappings |
| `app/ui/lit-localize.json` | i18n source/target locales, XLIFF dir |
| `app/ui/.eslintrc.json` | ESLint (lit + prettier plugins) |
| `app/ui/.prettierrc` | Prettier (semicolons, single quotes, trailing commas) |

### Path Aliases (Vite + tsconfig)

| Alias | Resolves to |
|---|---|
| `@/*` | `src/*` |
| `@/features/*` | `src/features/*` |
| `@/pages/*` | `src/pages/*` |
| `@/shared/*` | `src/shared/*` |
| `@/assets/*` | `src/assets/*` |

## Build & Deploy

```bash
# Install frontend dependencies
cd app/ui && bun install

# Build frontend (runs i18n:build + tsc + vite build)
cd app/ui && bun run build

# Watch mode
cd app/ui && bun run watch

# i18n workflow
bun i18n:extract   # extract msg() strings → xliff/*.xlf
bun i18n:build     # compile xliff → generated/locales/*.ts

# Build and run backend
cargo build --release
cargo run
# Server starts at http://localhost:4000
```

## Open Questions

- Real Kanidm OIDC/API auth integration is a separate future design;
  `vendor/kanidm` is the reference for its actual auth endpoints/contracts.
- Whether kanidm-admin will eventually need any local persistent storage
  (settings, audit log) is deferred until a concrete need arises.
