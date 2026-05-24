# Chunk 9C — Dashboard Host Entry

**Depends on:** [06-api-routes](06-api-routes.md)  
**Parallel with:** 9A, 9B, 9D

## Goal

Dashboard entry + one-event gate.

## Modify

| File | Change |
|------|--------|
| [`client/src/pages/DashboardPage.tsx`](../../client/src/pages/DashboardPage.tsx) | "Start Quick Tournament" CTA; current event card; Complete button |
| [`client/src/__tests__/pages/DashboardPage.test.tsx`](../../client/src/__tests__/pages/DashboardPage.test.tsx) | **New file** |

## Behavior

- CTA hidden/disabled when `mine/current` returns open event
- Show link to current event + Complete instead

## Tests (write first)

- CTA hidden when open event exists
- Shows current event link + Complete

## Done when

Dashboard tests green.

## Next

→ [10-regression.md](10-regression.md)
