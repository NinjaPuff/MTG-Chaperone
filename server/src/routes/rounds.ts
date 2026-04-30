import { Router } from 'express';

const router = Router();

router.get('/:roundId', (_req, res) => {
  // TODO: Get round details
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Get round not yet implemented' } });
});

router.post('/:roundId/start', (_req, res) => {
  // TODO: Start a round
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Start round not yet implemented' } });
});

router.post('/:roundId/complete', (_req, res) => {
  // TODO: Complete a round
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Complete round not yet implemented' } });
});

router.post('/:roundId/regenerate', (_req, res) => {
  // TODO: Regenerate pairings for a round
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Regenerate round not yet implemented' } });
});

router.get('/:roundId/matches', (_req, res) => {
  // TODO: List matches for a round
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'List round matches not yet implemented' } });
});

export { router as roundsRouter };
