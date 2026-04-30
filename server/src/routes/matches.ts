import { Router } from 'express';

const router = Router();

router.get('/:matchId', (_req, res) => {
  // TODO: Get match details
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Get match not yet implemented' } });
});

router.post('/:matchId/report', (_req, res) => {
  // TODO: Report match result
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Report match not yet implemented' } });
});

router.post('/:matchId/confirm', (_req, res) => {
  // TODO: Confirm match result
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Confirm match not yet implemented' } });
});

router.post('/:matchId/dispute', (_req, res) => {
  // TODO: Dispute match result
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Dispute match not yet implemented' } });
});

router.post('/:matchId/resolve', (_req, res) => {
  // TODO: Resolve match dispute
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Resolve match not yet implemented' } });
});

export { router as matchesRouter };
