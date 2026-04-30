import { Router } from 'express';

const router = Router();

router.get('/:slug', (_req, res) => {
  // TODO: Get user profile by slug
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Get user not yet implemented' } });
});

router.patch('/:slug', (_req, res) => {
  // TODO: Update user profile
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Update user not yet implemented' } });
});

router.get('/:slug/match-history', (_req, res) => {
  // TODO: Get user match history
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Get match history not yet implemented' } });
});

export { router as usersRouter };
