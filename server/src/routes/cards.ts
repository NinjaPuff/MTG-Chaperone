import { Router } from 'express';

const router = Router();

router.get('/search', (_req, res) => {
  // TODO: Search cards by name/set/etc.
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Search cards not yet implemented' } });
});

router.get('/:scryfallId', (_req, res) => {
  // TODO: Get card by Scryfall ID
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Get card not yet implemented' } });
});

router.post('/bulk-lookup', (_req, res) => {
  // TODO: Look up multiple cards by IDs
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Bulk lookup cards not yet implemented' } });
});

export { router as cardsRouter };
