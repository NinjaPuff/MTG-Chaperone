# Chunk 2 — Pure Rules

**Depends on:** [01-schema](01-schema.md)  
**Parallel with:** [04-event-auth](04-event-auth.md)

## Goal

Testable pure functions with **zero Prisma**.

## Create

| File | Exports |
|------|---------|
| [`server/src/services/quickEventRules.ts`](../../server/src/services/quickEventRules.ts) | See below |
| [`server/src/__tests__/unit/quickEventRules.test.ts`](../../server/src/__tests__/unit/quickEventRules.test.ts) | All matrix cases |

## Functions

### `assertHostCanCreateQuickEvent(openEvent)`

- Input: existing open event or `null`
- Throws `AppError` `409` / `HOST_EVENT_OPEN` if status is `setup` or `active`

### `canActorReportQuickMatch(actor, match, event, playerGuestFlags)`

Pure boolean — see [product-rules.md](../product-rules.md). No DB.

### `shouldAutoConfirmQuickMatchReport(...)`

- `true` when host/admin reports, or when any side is walk-in
- `false` when reg vs reg and reporter is participant (opponent must confirm)

## Tests (write first)

Cover full reporting matrix from [product-rules.md](../product-rules.md).

## Done when

`npm run test --workspace=server` passes for `quickEventRules.test.ts`.

## Pitfalls

- Putting Prisma in this file
- Coupling to Express `req` — pass plain objects

## Next

→ [03-service.md](03-service.md)
