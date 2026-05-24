# Chunk 9E — App Routes + Wiring

**Depends on:** [09a-event-board](09a-event-board.md), [09b-wizard](09b-wizard.md)  
**Parallel with:** —

## Goal

Register client routes; align API paths.

## Modify

| File | Change |
|------|--------|
| [`client/src/App.tsx`](../../client/src/App.tsx) | `/quick/new`, `/quick/:shareToken` |
| [`client/src/lib/api.ts`](../../client/src/lib/api.ts) | Optional typed helpers for quick endpoints |

## Done when

- Navigation works manually
- Client tests still green

## Next

→ [10-regression.md](10-regression.md)
