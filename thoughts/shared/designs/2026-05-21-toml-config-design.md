---
date: 2026-05-21
topic: "Layered TOML Configuration (appsettings pattern)"
status: validated
---

## Problem Statement

The Rust backend currently reads configuration exclusively via environment variables
(`FRONTEND_BUILD`, `FRONTEND_WATCH`, `PUBLIC_DIR`) loaded through `dotenvy`. This is
fragile — there is no typed structure, no defaults codified in files, and no way to
maintain environment-specific overrides without editing shell scripts or `.env` files.

We want the same layered configuration pattern familiar from .NET:
`appsettings.toml` as the base, `appsettings.<env>.toml` as environment-specific
overrides, and environment variables as the final override layer.

## Constraints

- Rust backend only (frontend is irrelevant here)
- Must preserve existing behaviour (same defaults as current `cfg!(debug_assertions)` logic)
- `dotenvy` stays for local secrets (not removed, just demoted)
- No breaking changes to TrailBase or Axum setup
- New crate must be actively maintained and well-known in the Rust ecosystem

## Approach

Use the **`config`** crate (layered configuration builder) with **`serde`** deserialization
into typed structs.

Layers applied in order (each overrides the previous):

1. `appsettings.toml` — shared base with all defaults
2. `appsettings.{APP_ENV}.toml` — environment-specific overrides (optional file)
3. `APP_*` environment variables — runtime overrides for CI/CD and secrets

`APP_ENV` defaults to `development` if not set.

Env var mapping uses double-underscore notation for nesting:
`APP_SERVER__ADDRESS=0.0.0.0:8080` overrides `settings.server.address`.

`config` was chosen over `figment` because:
- Larger adoption; more .NET-familiar builder pattern
- Native support for `required(false)` on optional environment files
- Full TOML support via the `toml` feature flag

## Architecture

```
app/
├── appsettings.toml                  # Shared base config (committed)
├── appsettings.development.toml      # Dev overrides (committed)
├── appsettings.production.toml       # Prod overrides (committed)
├── appsettings.local.toml            # Local personal overrides (gitignored)
└── src/
    ├── main.rs                       # Calls Settings::load(), uses typed values
    └── settings.rs                   # Settings structs + load() function
```

## Components

### `settings.rs`

Owns all configuration types and loading logic. Exports only `Settings` and the
`load()` function (or `Settings::load()`).

**Types:**

- `Settings` — root, contains `server: ServerSettings` and `frontend: FrontendSettings`
- `ServerSettings` — `address: String` (default: `"0.0.0.0:4000"`)
- `FrontendSettings` — `build: bool`, `watch: bool`, `public_dir: String`
  - `public_dir` empty string = derive from `CARGO_MANIFEST_DIR` at runtime

**`Settings::load()` behaviour:**

1. Read `APP_ENV` from environment, default to `"development"`
2. Build `Config` with sources in order:
   a. `appsettings.toml` (required)
   b. `appsettings.{env}.toml` (optional)
   c. `appsettings.local.toml` (optional, gitignored, for personal overrides)
   d. Environment variables prefixed `APP_`, separator `__`
3. Deserialize into `Settings`
4. Return `Result<Settings, config::ConfigError>`

### `appsettings.toml` (base)

```toml
[server]
address = "0.0.0.0:4000"

[frontend]
build = false
watch = false
public_dir = ""
```

### `appsettings.development.toml`

```toml
[frontend]
watch = true
```

### `appsettings.production.toml`

```toml
[frontend]
build = true
```

### `appsettings.local.toml` (gitignored, template provided)

Empty by default. For developer personal overrides without affecting team defaults.

### `main.rs` changes

- Remove `parse_bool_env()` helper function
- Remove all `std::env::var(...)` calls for config values
- Call `Settings::load()?` early in `main()`
- Pass `settings.frontend.*` and `settings.server.*` to relevant code paths
- Keep `dotenvy::dotenv()` call (for secrets like API keys, not config)

## Data Flow

```
Startup
  │
  ├─ dotenvy::dotenv()            # Load .env (secrets only)
  │
  ├─ Settings::load()
  │     ├─ appsettings.toml       # Defaults
  │     ├─ appsettings.{env}.toml # Env overrides
  │     ├─ appsettings.local.toml # Personal overrides
  │     └─ APP_* env vars         # Runtime overrides
  │
  ├─ Use settings.server.address  → TrailBase address
  ├─ Use settings.frontend.build  → conditional bun build
  ├─ Use settings.frontend.watch  → conditional bun watch
  └─ Use settings.frontend.public_dir → static file serving path
```

## Error Handling

- `Settings::load()` returns `Result` — errors propagate via `?` in `main()`
- Missing `appsettings.toml` is a hard error (app cannot start without base config)
- Missing `appsettings.{env}.toml` is silently ignored (`.required(false)`)
- Invalid TOML or type mismatch produces a descriptive `config::ConfigError`
- `public_dir` empty string is resolved to the `CARGO_MANIFEST_DIR`-relative default
  inside `main()`, not inside `settings.rs` (keep settings pure data)

## Testing Strategy

- Unit test `Settings::load()` by setting `APP_ENV` and writing temp TOML files,
  or by using `config::Config::builder()` with in-memory string sources
- Test that `development` env loads watch=true, build=false
- Test that `production` env loads watch=false, build=true
- Test that `APP_FRONTEND__BUILD=false` overrides production default
- Test that missing env file does not panic

## Open Questions

- None — all design decisions are resolved.
