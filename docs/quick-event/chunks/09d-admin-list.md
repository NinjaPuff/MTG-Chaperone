# Chunk 9D — Admin Active Events List

**Depends on:** [06-api-routes](06-api-routes.md)  
**Parallel with:** 9A, 9B, 9C

## Goal

Site admin list of all active ad-hoc events.

## Modify

| File | Change |
|------|--------|
| [`client/src/pages/AdminPage.tsx`](../../client/src/pages/AdminPage.tsx) | "Active Ad-hoc Events" section |
| [`client/src/__tests__/pages/AdminPage.test.tsx`](../../client/src/__tests__/pages/AdminPage.test.tsx) | **New file** |

Optional extract: [`client/src/components/admin/ActiveQuickEventsTable.tsx`](../../client/src/components/admin/ActiveQuickEventsTable.tsx)

## UI

- Table: name, host, status, player count, current round, created
- Actions: Open board (`/quick/:shareToken`), Copy share link
- Empty state
- Data: `GET /api/admin/quick-events`

## Tests (write first)

- Renders rows from API
- Copy link action
- Empty state

## Done when

Admin section tests green.

## Next

→ [10-regression.md](10-regression.md)
