import { Router } from 'express';

const router = Router();

router.get('/:poolId', (_req, res) => {
  // TODO: Get card pool details
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Get card pool not yet implemented' } });
});

router.post('/:poolId/acquisitions', (_req, res) => {
  // TODO: Create a card acquisition for a pool
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Create acquisition not yet implemented' } });
});

router.patch('/acquisitions/:acquisitionId/approve', (_req, res) => {
  // TODO: Approve a card acquisition
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Approve acquisition not yet implemented' } });
});

router.patch('/acquisitions/:acquisitionId/reject', (_req, res) => {
  // TODO: Reject a card acquisition
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Reject acquisition not yet implemented' } });
});

export { router as cardPoolsRouter };
