import { Router } from 'express';
import { getDecklistShare } from '../services/decklistShareService.js';

const router = Router();

router.get('/decklists/:token', async (req, res, next) => {
  try {
    const payload = await getDecklistShare(req.params.token);
    res.json({ data: payload });
  } catch (error) {
    next(error);
  }
});

export { router as shareRouter };
