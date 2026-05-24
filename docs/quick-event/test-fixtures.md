# Quick Event — Test Fixtures

Use these UUIDs consistently across all chunk tests.

| Fixture | UUID | Notes |
|---------|------|-------|
| `hostUser` | `11111111-1111-4111-8111-111111111111` | `role: user`, becomes `organizerId` |
| `playerUser` | `22222222-2222-4222-8222-222222222222` | Registered roster member |
| `spectatorUser` | `33333333-3333-4333-8333-333333333333` | Logged in, not on roster |
| `siteAdmin` | `44444444-4444-4444-8444-444444444444` | `role: admin` |
| `walkInUser` | `55555555-5555-4555-8555-555555555555` | `isGuest: true` |

## Route test auth pattern

Reuse hoisted mock from [`server/src/__tests__/routes/events.test.ts`](../../server/src/__tests__/routes/events.test.ts). Swap `req.user` per `describe` block — do not leak roles between tests.

## Assertion standards

- Assert error **codes** (`HOST_EVENT_OPEN`, `FORBIDDEN`, `DUPLICATE_WALK_IN`), not just thrown
- On failure paths: assert mocks **not** called (`league.create`, `match.update`)
- Reset `prismaMock` in `beforeEach`

## Client tests

Mock `@/lib/api` and auth context — pattern in [`client/src/__tests__/pages/StandingsPage.test.tsx`](../../client/src/__tests__/pages/StandingsPage.test.tsx).
