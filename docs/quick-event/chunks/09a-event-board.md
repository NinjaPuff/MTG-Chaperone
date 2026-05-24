# Chunk 9A — Event Board Page

**Depends on:** [06-api-routes](06-api-routes.md)  
**Parallel with:** 9B, 9C, 9D, [08-ui-isolation](08-ui-isolation.md)

## Goal

Public scoreboard at `/quick/:shareToken` + conditional auth actions.

## Create

| File | Purpose |
|------|---------|
| [`client/src/pages/QuickEventPage.tsx`](../../client/src/pages/QuickEventPage.tsx) | Board page |
| [`client/src/__tests__/pages/QuickEventPage.test.tsx`](../../client/src/__tests__/pages/QuickEventPage.test.tsx) | Write first |

## UI sections

1. **Header** — name, status, round
2. **Standings / pairings** — reuse [`MatchCard`](../../client/src/components/MatchCard.tsx)
3. **Join** — logged in + `setup` + not on roster
4. **Report** — [`ReportMatchDialog`](../../client/src/components/ReportMatchDialog.tsx) when allowed
5. **Host strip** — walk-ins, start event, rounds, complete event

## Tests (write first)

- Renders without auth
- No report buttons when logged out
- Participant sees report on own reg vs reg match
- Spectator does not
- Host sees report on all matches + host strip

## Done when

Page tests green.

## Next

→ [09e-app-routes.md](09e-app-routes.md)
