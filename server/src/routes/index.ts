import { Router } from 'express';
import { createAuthRouter } from './auth.js';
import { leaguesRouter } from './leagues.js';
import { seasonsRouter } from './seasons.js';
import { eventsRouter } from './events.js';
import { roundsRouter } from './rounds.js';
import { matchesRouter } from './matches.js';
import { standingsRouter } from './standings.js';
import { cardPoolsRouter } from './cardPools.js';
import { decklistsRouter } from './decklists.js';
import { usersRouter } from './users.js';
import { adminRouter } from './admin.js';
import { invitesRouter } from './invites.js';
import { boosterProductsRouter } from './boosterProducts.js';
import { cardsRouter } from './cards.js';
import { createSetsRouter } from './sets.js';
import { createMtgjsonRouter } from './mtgjson.js';
import type { AppDeps } from '../di/types.js';

export function createApiRouter(_deps?: AppDeps) {
  const deps = _deps;
  const router = Router();

  router.use('/auth', createAuthRouter(deps));
  router.use('/leagues', leaguesRouter);
  router.use('/invites', invitesRouter);
  router.use('/seasons', seasonsRouter);
  router.use('/events', eventsRouter);
  router.use('/rounds', roundsRouter);
  router.use('/matches', matchesRouter);
  router.use('/standings', standingsRouter);
  router.use('/card-pools', cardPoolsRouter);
  router.use('/decklists', decklistsRouter);
  router.use('/users', usersRouter);
  router.use('/admin', adminRouter);
  router.use('/booster-products', boosterProductsRouter);
  router.use('/cards', cardsRouter);
  router.use('/sets', createSetsRouter(deps));
  router.use('/mtgjson', createMtgjsonRouter(deps));

  return router;
}

const apiRouter = createApiRouter();
export { apiRouter };
