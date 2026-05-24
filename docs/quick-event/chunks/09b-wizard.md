# Chunk 9B — Wizard Page

**Depends on:** [06-api-routes](06-api-routes.md)  
**Parallel with:** 9A, 9C, 9D

## Goal

Create flow at `/quick/new` with one-open-event gate.

## Create

| File | Purpose |
|------|---------|
| [`client/src/pages/QuickEventWizardPage.tsx`](../../client/src/pages/QuickEventWizardPage.tsx) | Wizard |
| [`client/src/__tests__/pages/QuickEventWizardPage.test.tsx`](../../client/src/__tests__/pages/QuickEventWizardPage.test.tsx) | Write first |

## Flow

1. Mount: `GET /api/quick-events/mine/current` — redirect if open event
2. Steps: name/format → optional walk-ins → seeds (seeded Swiss) → launch
3. `POST /api/quick-events` → show share URL + copy

## Tests (write first)

- Redirect/message when `mine/current` returns open event
- Successful create shows share URL

## Done when

Wizard tests green.

## Next

→ [09e-app-routes.md](09e-app-routes.md)
