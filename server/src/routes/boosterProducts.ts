import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  // TODO: List all booster products
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'List booster products not yet implemented' } });
});

router.post('/', (_req, res) => {
  // TODO: Create a booster product
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Create booster product not yet implemented' } });
});

router.get('/:id', (_req, res) => {
  // TODO: Get booster product details
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Get booster product not yet implemented' } });
});

router.patch('/:id', (_req, res) => {
  // TODO: Update a booster product
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Update booster product not yet implemented' } });
});

router.delete('/:id', (_req, res) => {
  // TODO: Delete a booster product
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Delete booster product not yet implemented' } });
});

export { router as boosterProductsRouter };
