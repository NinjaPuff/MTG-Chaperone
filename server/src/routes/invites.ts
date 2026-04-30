import { Router } from 'express';

const router = Router();

router.get('/:token', (_req, res) => {
  // TODO: Validate invite token (public)
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Validate invite not yet implemented' } });
});

export { router as invitesRouter };
