# Chunk 4 — eventAuth Middleware

**Depends on:** [01-schema](01-schema.md)  
**Parallel with:** [02-pure-rules](02-pure-rules.md)

## Goal

Resolve event and gate host-or-admin access.

## Create

| File | Exports |
|------|---------|
| [`server/src/middleware/eventAuth.ts`](../../server/src/middleware/eventAuth.ts) | `requireEventHostOrAdmin`, `loadQuickEventForAuth(eventId)` |
| [`server/src/__tests__/unit/eventAuth.test.ts`](../../server/src/__tests__/unit/eventAuth.test.ts) | Write first |

## Logic

```typescript
// requireEventHostOrAdmin: after requireAuth
// Allow if user.role === 'admin' OR event.organizerId === user.id
// Only for event.isQuickEvent === true
```

## Tests

| Test | Assert |
|------|--------|
| Host | `next()` called |
| Non-host | `403 FORBIDDEN` |
| Site admin | `next()` called |
| League (non-quick) event + non-admin | Blocked |

## Done when

Middleware unit tests green.

## Pitfalls

- Applying host bypass to non-quick events — league events stay site-admin-only

## Next

→ [05-host-permissions.md](05-host-permissions.md)
