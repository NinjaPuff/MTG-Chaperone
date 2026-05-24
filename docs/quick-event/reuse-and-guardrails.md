# Quick Event — Reuse & Guardrails

## Reuse (do NOT reinvent)

| Concern | File |
|---------|------|
| Swiss / seeded Swiss pairing | [`server/src/services/pairingService.ts`](../../server/src/services/pairingService.ts) |
| Round lifecycle | [`server/src/services/roundService.ts`](../../server/src/services/roundService.ts) |
| Event start/complete | [`server/src/services/eventService.ts`](../../server/src/services/eventService.ts) |
| Match report UI | [`client/src/components/ReportMatchDialog.tsx`](../../client/src/components/ReportMatchDialog.tsx) |
| League slug helper | [`server/src/services/leagueService.ts`](../../server/src/services/leagueService.ts) |
| Prisma mocks | [`server/src/__tests__/helpers/prismaMock.js`](../../server/src/__tests__/helpers/prismaMock.js) |

## Do NOT touch (unless chunk doc says so)

- `pairSequential`, `pairTopVsBottom`, `generateSwissPairings` logic
- Box league / card pool / deckbuilder pages
- Round-robin code paths
- OAuth / passport configuration

## Architecture reminder

Each quick event auto-provisions: **hidden League → Season 1 → Event**. Reuses existing Swiss round/match flow inside that sandbox. See plan for diagram.
