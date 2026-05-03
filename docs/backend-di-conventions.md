# Backend DI Conventions

This project uses incremental dependency injection in the backend to improve testability and keep behavior deterministic.

## Composition Root

- Runtime wiring starts in `server/src/index.ts`.
- `loadConfig()` reads and validates environment values.
- `createDeps(config)` builds default runtime dependencies.
- `createApp(deps)` wires middleware/routes using injected dependencies.

## Core Dependency Contract

Defined in `server/src/di/types.ts`:

- `config`
- `logger`
- `clock`
- `rng`
- `http`
- `prisma`
- `services` (cross-cutting middleware/configured services)

## Service Factories

Where available, services expose `createXService()` in addition to compatibility exports.

Guidelines:

1. Keep compatibility exports during transition.
2. Prefer injected collaborators for side effects.
3. Keep pure logic extracted and directly unit-testable.

## Route Factories

Route modules can expose `createXRouter()` while preserving existing `xRouter` exports for compatibility.

Guidelines:

1. Use injected middleware/services where available.
2. Keep route handlers thin.
3. Avoid direct singleton access in new/modified code when a dependency is injectable.

## Test Conventions

- Use `createTestDeps()` from `server/src/__tests__/helpers/createTestDeps.ts` for dependency-aware tests.
- Continue using existing route/module mocks for unmigrated areas.
- Prefer explicit logger/clock/rng/http injection over global monkey-patching.
