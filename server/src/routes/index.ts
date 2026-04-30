import { Router } from 'express';
import { authRouter } from './auth.js';
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
import { setsRouter } from './sets.js';
import { mtgjsonRouter } from './mtgjson.js';

const router = Router();

router.use('/auth', authRouter);
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
router.use('/sets', setsRouter);
router.use('/mtgjson', mtgjsonRouter);

export { router as apiRouter };
