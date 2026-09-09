# Rust Backend

## Brief overview

Architecture and style rules for the Rust backend (`app/src/`).

## main.rs — thin orchestration only

`main.rs` is the entry point, not a dumping ground. Its responsibility is
wiring together modules in the correct order:

1. Bootstrap (dotenv, tracing)
2. Load configuration (`Settings::load()`)
3. Call helpers from dedicated modules
4. Start the server

**Do not put business logic in main.rs.** Any block of code that has a
clear single purpose (build frontend, serve routes, watch files, etc.)
belongs in its own module.

**No if/else in main.rs.** Conditional logic is an implementation detail
that belongs inside methods and module functions. `main.rs` should read as
a sequence of clean method calls that return values:

```rust
// Good
let public_dir = settings.frontend.resolve_public_dir(&manifest_dir);
let _bun_watch = frontend::start(&settings.frontend, &ui_dir)?;

// Bad — if/else inline in main.rs leaks implementation details
let public_dir = if settings.frontend.public_dir.is_empty() { ... };
if settings.frontend.build { frontend::build(&ui_dir)?; }
```

## Module extraction rules

Extract to a separate file when:

- The code block has a single, nameable responsibility
- The logic could be reused in another project with minimal changes
- The function is longer than ~10 lines and conceptually self-contained

Current modules:

| File | Responsibility |
|---|---|
| `build.rs` | Compile-time frontend build: ensure `ui/dist`, skip flag (`APP_SKIP_FRONTEND_BUILD=1`), stale-check `bun install`, `bun run build` |
| `settings.rs` + `settings/` | Layered TOML configuration: `loader.rs` (layering), `server.rs`, `frontend.rs` (serve_from/watch/public_dir), `tests.rs` |
| `frontend.rs` | Serving-mode validation, `bun watch` spawn, `FrontendHandle` lifetime |
| `frontend_assets.rs` | rust-embed asset container over `ui/dist` (embedded in release, disk-read in debug) |
| `routes.rs` | Custom API handlers, disk/embedded SPA fallbacks, `mount_fallback` chooser |
| `preflight.rs` | CLI dependency checks |
| `logging.rs` | Tracing filter + `pretty_env_logger` init |

## build.rs — compile-time frontend build

`app/build.rs` runs `bun install` (only when `node_modules` is stale) and
`bun run build` before the crate compiles, so rust-embed can embed
`ui/dist` into release binaries. `APP_SKIP_FRONTEND_BUILD=1` turns it into
a fast no-op that still ensures `ui/dist` exists (Docker's Rust stage uses
this). rerun-if-changed covers `ui/package.json` and `ui/bun.lock` only —
dev rebuilds come from `bun watch`, not cargo.

## Test string formatting

Multi-line TOML (or any string) constants in tests must use `indoc::indoc!`
so they can be indented naturally with the surrounding code.

```rust
use indoc::indoc;

const BASE_TOML: &str = indoc! {r#"
    [server]
    address = "0.0.0.0:4000"

    [frontend]
    build = false
"#};
```

`indoc` strips the common leading whitespace, so the final string has no
leading spaces — correct for TOML. Add `indoc = "2"` to `[dev-dependencies]`.

## No unsolicited template files

Never create `.example`, `.sample`, or `.template` files (e.g.
`appsettings.local.toml.example`, `.env.example`) unless the user
explicitly asks for them. These files add clutter and imply the project
needs setup instructions that were not requested.
