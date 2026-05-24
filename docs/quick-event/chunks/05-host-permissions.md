# Chunk 5 — Host Permissions on Existing Routes

**Depends on:** [01-schema](01-schema.md), [04-event-auth](04-event-auth.md)  
**Parallel with:** —

## Goal

Event hosts run rounds on **their** quick events without site admin.

## Modify

| File | Change |
|------|--------|
| [`server/src/routes/events.ts`](../../server/src/routes/events.ts) | Quick events: `start`, `complete`, `rounds` POST → host or admin |
| [`server/src/routes/rounds.ts`](../../server/src/routes/rounds.ts) | Quick events: `start`, `complete`, `regenerate`, `delete` → host or admin |
| [`server/src/__tests__/routes/events.test.ts`](../../server/src/__tests__/routes/events.test.ts) | Host start/complete own quick event |
| [`server/src/__tests__/routes/rounds.test.ts`](../../server/src/__tests__/routes/rounds.test.ts) | Host start round on quick event |

## Test pattern

Swap `req.user` mock between host (`role: user`) and stranger. Fixture: `isQuickEvent: true`, `organizerId: hostUser.id`. See [test-fixtures.md](../test-fixtures.md).

## Tests (write first)

| Test | Assert |
|------|--------|
| Host start own quick event | `200` without site admin |
| Non-host start quick event | `403` |
| Host complete → can create again | Integration with create guard |
| League event start | Still requires site admin |

## Done when

Route tests pass; league events unchanged.

## Pitfalls

- Replacing `requireAdmin` globally — must branch on `isQuickEvent`

## Next

→ [06-api-routes.md](06-api-routes.md)
