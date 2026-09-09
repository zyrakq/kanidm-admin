set dotenv-load

run:
    cargo run

[no-exit-message]
kill:
    #!/usr/bin/env bash
    set -euo pipefail
    pkill -f "cargo test" 2>/dev/null || true
    pkill -f "cargo check" 2>/dev/null || true
    pkill -f "cargo run" 2>/dev/null || true
    pkill -f "just run" 2>/dev/null || true
    pkill -f "bun run build --watch" 2>/dev/null || true
    sleep 2
    echo "done"
