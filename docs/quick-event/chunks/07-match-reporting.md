# Chunk 7 — Match Reporting

**Depends on:** [01-schema](01-schema.md), [02-pure-rules](02-pure-rules.md), [06-api-routes](06-api-routes.md)  
**Parallel with:** [08-ui-isolation](08-ui-isolation.md), frontend 9A–9D

## Goal

Enforce quick-event reporting matrix without breaking league matches.

## Modify

| File | Change |
|------|--------|
| [`server/src/services/matchService.ts`](../../server/src/services/matchService.ts) | Use `canActorReportQuickMatch` + `shouldAutoConfirmQuickMatchReport` when `event.isQuickEvent` |
| [`server/src/__tests__/services/matchService.test.ts`](../../server/src/__tests__/services/matchService.test.ts) | Add quick event cases |

## Behavior

| Scenario | Result |
|----------|--------|
| Participant reg vs reg report | `reported` → opponent confirms → `confirmed` |
| Host/admin reports reg vs reg | `confirmed` immediately |
| Reg vs walk-in (registered reporter) | `confirmed` immediately |
| Spectator reports | `403`, no DB update |
| Walk-in vs walk-in (host) | `confirmed` immediately |

Fixtures: include `isQuickEvent: true` on nested `event`; load `isGuest` on players.

## Tests (write first)

See [product-rules.md](../product-rules.md) reporting table. Assert league match tests still pass unchanged.

## Done when

Extended `matchService.test.ts` green.

## Pitfalls

- Changing confirm flow for non-quick events
- Forgetting `isGuest` on player records

## Next

→ [10-regression.md](10-regression.md)
