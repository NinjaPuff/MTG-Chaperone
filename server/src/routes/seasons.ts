import { Router } from 'express';

const router = Router();

router.get('/:seasonId/standings', (_req, res) => {
  // TODO: Get standings for a season
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Get season standings not yet implemented' } });
});

router.get('/:seasonId/events', (_req, res) => {
  // TODO: List events for a season
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'List season events not yet implemented' } });
});

router.post('/:seasonId/events', (_req, res) => {
  // TODO: Create event in a season
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Create season event not yet implemented' } });
});

router.get('/:seasonId/card-pools', (_req, res) => {
  // TODO: List card pools for a season
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'List season card pools not yet implemented' } });
});

export { router as seasonsRouter };
