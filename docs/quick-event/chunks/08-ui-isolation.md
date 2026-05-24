# Chunk 8 — League UI Isolation

**Depends on:** [06-api-routes](06-api-routes.md)  
**Parallel with:** [07-match-reporting](07-match-reporting.md), 9A–9D

## Goal

Quick events don't leak into main box league UX.

## Modify

| File | Change |
|------|--------|
| Event GET handler | Quick event by ID without token → `404` |
| Season events list API (if used by schedule) | Exclude `isQuickEvent` |
| [`client/src/pages/SchedulePage.tsx`](../../client/src/pages/SchedulePage.tsx) | Filter or rely on API exclude |
| [`client/src/pages/DashboardPage.tsx`](../../client/src/pages/DashboardPage.tsx) | Exclude from league event widgets (quick-event CTAs are separate — see 9C) |

Optional: `isLeagueEvent(event)` helper + unit test.

## Tests

- Quick events absent from schedule data
- `GET /api/events/:id` for quick event returns `404` (or redirect policy)

## Done when

Isolation tests pass; main league schedule unchanged for normal events.

## Next

→ [10-regression.md](10-regression.md)
