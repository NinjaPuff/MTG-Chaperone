# Chunk 1 — Schema + Shared Types

**Depends on:** [00-baseline](00-baseline.md)  
**Parallel with:** —

## Goal

Add DB fields and TypeScript types only. **No business logic.**

## Modify

| File | Change |
|------|--------|
| [`server/prisma/schema.prisma`](../../server/prisma/schema.prisma) | `Event.isQuickEvent`, `Event.organizerId`, `Event.shareToken`, `User.isGuest`; relation `Event.organizer → User`; `@@index([organizerId, isQuickEvent, status])` |
| [`shared/src/types/entities.ts`](../../shared/src/types/entities.ts) | Mirror new fields on `Event`, `User` |
| Migration | `npm run db:migrate` |

## Defaults

- `isQuickEvent`: `false`
- `isGuest`: `false`
- `shareToken`: nullable, unique
- `organizerId`: nullable FK

## Tests

None required (no behavior change). Existing suite must still pass.

## Done when

- Migration applies
- `shared` builds
- `npm run test` still green

## Pitfalls

- Forgetting `organizer` relation on `User`
- Forgetting shared types (client won't compile later)

## Next

→ [02-pure-rules.md](02-pure-rules.md) and [04-event-auth.md](04-event-auth.md) (parallel)
