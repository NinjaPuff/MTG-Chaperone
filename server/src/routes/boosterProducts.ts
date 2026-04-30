import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../lib/validate.js';
import {
  createBoosterProduct,
  deleteBoosterProduct,
  getBoosterProduct,
  listBoosterProducts,
  updateBoosterProduct,
} from '../services/boosterProductService.js';

const router = Router();

const boosterSchema = z.object({
  name: z.string().min(2),
  setReleaseName: z.string().min(2),
  boosterType: z.enum(['draft', 'play', 'set', 'collector']),
  setCodes: z.array(z.string().min(2)),
});

router.get('/', async (_req, res, next) => {
  try {
    const products = await listBoosterProducts();
    res.json({ data: products });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, validateBody(boosterSchema), async (req, res, next) => {
  try {
    const product = await createBoosterProduct(req.body);
    res.status(201).json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await getBoosterProduct(req.params.id);
    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireAuth, validateBody(boosterSchema.partial()), async (req, res, next) => {
  try {
    const product = await updateBoosterProduct(req.params.id, req.body);
    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await deleteBoosterProduct(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { router as boosterProductsRouter };
