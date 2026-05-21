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

## Module extraction rules

Extract to a separate file when:

- The code block has a single, nameable responsibility
- The logic could be reused in another project with minimal changes
- The function is longer than ~10 lines and conceptually self-contained

Current modules:

| File | Responsibility |
|---|---|
| `settings.rs` | Layered TOML configuration loading |
| `frontend.rs` | Frontend build (`bun run build`) and watch (`bun watch`) |
| `routes.rs` | Custom API handlers and router assembly |

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
