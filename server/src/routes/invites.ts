import { Router } from 'express';
import { validateInviteToken } from '../services/inviteService.js';

const router = Router();

router.get('/:token', async (req, res, next) => {
  try {
    const invite = await validateInviteToken(req.params.token);
    res.json({
      data: {
        token: invite.token,
        expiresAt: invite.expiresAt,
        maxUses: invite.maxUses,
        useCount: invite.useCount,
        league: invite.league,
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as invitesRouter };
