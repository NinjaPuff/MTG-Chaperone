import { Router } from 'express';

const router = Router();

router.get('/:decklistId', (_req, res) => {
  // TODO: Get decklist details
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Get decklist not yet implemented' } });
});

router.post('/', (_req, res) => {
  // TODO: Create a new decklist
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Create decklist not yet implemented' } });
});

router.patch('/:decklistId', (_req, res) => {
  // TODO: Update a decklist
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Update decklist not yet implemented' } });
});

router.post('/:decklistId/submit', (_req, res) => {
  // TODO: Submit a decklist for review
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Submit decklist not yet implemented' } });
});

router.post('/:decklistId/import', (_req, res) => {
  // TODO: Import decklist from external format
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Import decklist not yet implemented' } });
});

router.get('/:decklistId/export/:format', (_req, res) => {
  // TODO: Export decklist in specified format
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Export decklist not yet implemented' } });
});

router.get('/:decklistId/validate', (_req, res) => {
  // TODO: Validate decklist against card pool
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Validate decklist not yet implemented' } });
});

export { router as decklistsRouter };
