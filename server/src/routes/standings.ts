import { Router } from 'express';
import { getStandings, recomputeStandings } from '../services/standingsService.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/:seasonId', async (req, res, next) => {
  try {
    const standings = await getStandings(req.params.seasonId);
    res.json({ data: standings });
  } catch (error) {
    next(error);
  }
});

router.post('/:seasonId/recompute', requireAuth, async (req, res, next) => {
  try {
    await recomputeStandings(req.params.seasonId);
    const standings = await getStandings(req.params.seasonId);
    res.json({ data: standings });
  } catch (error) {
    next(error);
  }
});

export { router as standingsRouter };
