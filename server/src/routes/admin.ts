import { Router } from 'express';

const router = Router();

router.post('/matches/batch-report', (_req, res) => {
  // TODO: Batch report match results
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Batch report matches not yet implemented' } });
});

router.get('/disputes', (_req, res) => {
  // TODO: List all open disputes
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'List disputes not yet implemented' } });
});

router.post('/players/:userId/drop', (_req, res) => {
  // TODO: Drop a player from the league
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Drop player not yet implemented' } });
});

export { router as adminRouter };
