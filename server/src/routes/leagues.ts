import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  // TODO: List all leagues (public)
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'List leagues not yet implemented' } });
});

router.post('/', (_req, res) => {
  // TODO: Create a new league (authenticated)
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Create league not yet implemented' } });
});

router.get('/:slug', (_req, res) => {
  // TODO: Get league by slug (public)
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Get league not yet implemented' } });
});

router.patch('/:slug', (_req, res) => {
  // TODO: Update league settings (admin)
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Update league not yet implemented' } });
});

router.delete('/:slug', (_req, res) => {
  // TODO: Delete league (admin)
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Delete league not yet implemented' } });
});

router.get('/:slug/members', (_req, res) => {
  // TODO: List league members (public)
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'List members not yet implemented' } });
});

router.post('/:slug/join', (_req, res) => {
  // TODO: Join league via invite token (authenticated)
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Join league not yet implemented' } });
});

router.get('/:slug/invites', (_req, res) => {
  // TODO: List invite links (admin)
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'List invites not yet implemented' } });
});

router.post('/:slug/invites', (_req, res) => {
  // TODO: Create invite link (admin)
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Create invite not yet implemented' } });
});

router.delete('/:slug/invites/:id', (_req, res) => {
  // TODO: Revoke invite link (admin)
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Revoke invite not yet implemented' } });
});

router.get('/:slug/seasons', (_req, res) => {
  // TODO: List seasons for league (public)
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'List seasons not yet implemented' } });
});

router.post('/:slug/seasons', (_req, res) => {
  // TODO: Create season (admin)
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Create season not yet implemented' } });
});

router.get('/:slug/seasons/:number', (_req, res) => {
  // TODO: Get season details (public)
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Get season not yet implemented' } });
});

router.patch('/:slug/seasons/:number', (_req, res) => {
  // TODO: Update season (admin)
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Update season not yet implemented' } });
});

export { router as leaguesRouter };
