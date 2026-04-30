import { Router } from 'express';

const router = Router();

router.get('/discord', (_req, res) => {
  // TODO: Initiate Discord OAuth flow via Passport.js
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Discord OAuth not yet implemented' } });
});

router.get('/discord/callback', (_req, res) => {
  // TODO: Handle Discord OAuth callback, create/find user, issue JWT
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Discord OAuth callback not yet implemented' } });
});

router.get('/google', (_req, res) => {
  // TODO: Initiate Google OAuth flow via Passport.js
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Google OAuth not yet implemented' } });
});

router.get('/google/callback', (_req, res) => {
  // TODO: Handle Google OAuth callback, create/find user, issue JWT
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Google OAuth callback not yet implemented' } });
});

router.get('/me', (_req, res) => {
  // TODO: Return current authenticated user from JWT
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Get current user not yet implemented' } });
});

router.post('/logout', (_req, res) => {
  // TODO: Invalidate JWT session
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Logout not yet implemented' } });
});

export { router as authRouter };
