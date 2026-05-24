# Chunk 6 — Quick Event API Routes

**Depends on:** [03-service](03-service.md), [04-event-auth](04-event-auth.md), [05-host-permissions](05-host-permissions.md)  
**Parallel with:** — (unblocks 7, 8, 9A–9D)

## Goal

New public and authenticated endpoints.

## Create

| File | Purpose |
|------|---------|
| [`server/src/routes/quickEvents.ts`](../../server/src/routes/quickEvents.ts) | All new endpoints |
| [`server/src/__tests__/routes/quickEvents.test.ts`](../../server/src/__tests__/routes/quickEvents.test.ts) | Full route matrix |

## Modify

| File | Change |
|------|--------|
| [`server/src/routes/index.ts`](../../server/src/routes/index.ts) | Register quick event routers |

## Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/quick/:token` | None | Public board payload |
| POST | `/api/quick-events` | User | Create |
| POST | `/api/quick/:token/join` | User | Setup only |
| POST | `/api/quick/:token/walk-ins` | Host or admin | `{ displayName }` |
| GET | `/api/quick-events/mine` | User | Host history |
| GET | `/api/quick-events/mine/current` | User | Open event or null |
| GET | `/api/admin/quick-events` | Admin | Active ad-hoc list |

## Public GET response shape (stable for frontend)

Include: `event` (name, status, format), `roster[]`, `rounds[]` with `matches[]`, `standings[]`, `organizerId`, `shareToken`.

## Tests (write first)

| Endpoint | Cases | Expected |
|----------|-------|----------|
| `GET /api/quick/:token` | Valid / invalid token | `200` / `404`; no auth header on valid |
| `POST /api/quick-events` | No open event / open exists / no auth | `201` / `409 HOST_EVENT_OPEN` / `401` |
| `POST .../join` | Setup / active / no auth | `201` / `409` / `401` |
| `POST .../walk-ins` | Host / admin / spectator / duplicate name | `201` / `403` / `409 DUPLICATE_WALK_IN` |
| `GET /api/admin/quick-events` | Admin / user | `200` with shareToken per row / `403` |
| `GET .../mine/current` | Open / none | event / `null` |

## Done when

`quickEvents.test.ts` green; routes registered.

## Pitfalls

- Mounting public GET behind `requireAuth`
- Forgetting router in `index.ts`

## Next (parallel)

→ [07-match-reporting](07-match-reporting.md), [08-ui-isolation](08-ui-isolation.md), [09a-event-board](09a-event-board.md), [09b-wizard](09b-wizard.md), [09c-dashboard](09c-dashboard.md), [09d-admin-list](09d-admin-list.md)
