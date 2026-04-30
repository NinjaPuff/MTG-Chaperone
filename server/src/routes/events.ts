import { Router } from 'express';

const router = Router();

router.get('/:eventId', (_req, res) => {
  // TODO: Get event details
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Get event not yet implemented' } });
});

router.patch('/:eventId', (_req, res) => {
  // TODO: Update event settings
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Update event not yet implemented' } });
});

router.post('/:eventId/start', (_req, res) => {
  // TODO: Start an event
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Start event not yet implemented' } });
});

router.post('/:eventId/complete', (_req, res) => {
  // TODO: Complete an event
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Complete event not yet implemented' } });
});

router.get('/:eventId/rounds', (_req, res) => {
  // TODO: List rounds for an event
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'List event rounds not yet implemented' } });
});

router.post('/:eventId/rounds', (_req, res) => {
  // TODO: Create a round in an event
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Create event round not yet implemented' } });
});

router.get('/:eventId/decklists', (_req, res) => {
  // TODO: List decklists for an event
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'List event decklists not yet implemented' } });
});

export { router as eventsRouter };
