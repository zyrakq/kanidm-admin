# Project Structure

## Brief overview

Feature-based modular architecture preparing for future microfrontend migration.

## Core principles

- Isolation: Each feature is self-contained with its own components, services, types
- Public API: Features export via index.ts - only documented interfaces are public
- Scalability: Easy to extract features into separate packages later

## Directory organization

- `features/` - Isolated functional modules (auth, notifications, etc.)
- `pages/` - Top-level page components
- `shared/` - Reusable UI components not tied to specific features
- `assets/` - Static resources (images, icons, etc.)

## Feature structure

Each feature contains:

- `components/` - Feature-specific components
- `services/` - Business logic and API calls
- `types/` - TypeScript interfaces
- `index.ts` - Public API exports only

## Path strategy

- Intra-feature: relative paths
- Inter-feature: path aliases (`@/features/*`, `@/pages/*`, `@/shared/*`)
