# Chunk 3 — quickEventService

**Depends on:** [01-schema](01-schema.md), [02-pure-rules](02-pure-rules.md)  
**Parallel with:** —

## Goal

Orchestrate ephemeral league + season + event creation and listing.

## Create

| File | Functions |
|------|-----------|
| [`server/src/services/quickEventService.ts`](../../server/src/services/quickEventService.ts) | See below |
| [`server/src/__tests__/services/quickEventService.test.ts`](../../server/src/__tests__/services/quickEventService.test.ts) | Write first |

## Functions

- `createQuickEvent(hostId, input)`
- `getQuickEventByToken(token)`
- `listActiveQuickEvents()`
- `getCurrentOpenQuickEventForHost(hostId)`
- `addWalkIn(token, displayName)`
- `joinQuickEvent(token, userId)`

## `createQuickEvent` sequence

0. `assertHostCanCreateQuickEvent(await getCurrentOpenQuickEventForHost(hostId))`
1. Create league (`slug`: `quick-{shortId}`)
2. Create season 1 + `PointConfig`
3. Add host membership
4. Optional walk-ins: `User` (`isGuest: true`), memberships
5. Create `Event` + `EventConfig` (defaults in plan)
6. Seeded Swiss: write `EventSeed` rows
7. Return `{ eventId, shareToken, joinUrl, manageUrl }`

## Other rules

- `addWalkIn`: duplicate display name → `409 DUPLICATE_WALK_IN`
- `joinQuickEvent`: only when `status === 'setup'`

## Tests (write first)

| Test | Key assert |
|------|------------|
| Happy path create | League slug `quick-*`, flags set, shareToken present |
| Walk-in names | `isGuest: true` users created |
| Seeded seeds | `EventSeed` order matches input |
| Second create (setup/active) | `409 HOST_EVENT_OPEN`, `league.create` not called |
| After complete | Second create succeeds |
| `listActiveQuickEvents` | Only `setup`/`active` quick events |
| `getCurrentOpenQuickEventForHost` | Open or null |

## Done when

Service tests green. **No routes yet.**

## Pitfalls

- Using main league instead of new ephemeral league per event
- Skipping `PointConfig`

## Next

→ [06-api-routes.md](06-api-routes.md) (after 4, 5)
