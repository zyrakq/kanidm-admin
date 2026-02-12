# Development mode: build frontend in watch mode + run backend
dev:
	cd app/ui && bun watch &
	cd app && cargo run

# Production mode: build frontend + run backend in release mode
prod:
	cd app/ui && bun run build
	cd app && cargo run --release

# Run backend only (assumes frontend is already built)
run:
	cd app && cargo run
