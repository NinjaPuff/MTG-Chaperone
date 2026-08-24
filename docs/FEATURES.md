# Feature Specifications

MTG Chaperone — comprehensive feature specifications for all planned functionality.

## Priority Levels

- **P0** — Launch blocker. Required for the app to be minimally usable.
- **P1** — Important. Core functionality that differentiates the app.
- **P2** — Nice to have. Enhances the experience but not essential.

## Table of Contents

1. [User Authentication](#1-user-authentication) (P0)
2. [League & Season Management](#2-league--season-management) (P0)
3. [Booster Product & Set Configuration](#3-booster-product--set-configuration) (P0)
4. [Event Management](#4-event-management) (P0)
5. [Match Reporting](#5-match-reporting) (P0)
6. [Standings & Points](#6-standings--points) (P0)
7. [Tiebreaker Calculation](#7-tiebreaker-calculation) (P0)
8. [Tournament Pairing](#8-tournament-pairing) (P1)
9. [Player Drops](#9-player-drops) (P1)
10. [Card Pool Tracking](#10-card-pool-tracking) (P1)
11. [Decklist Management](#11-decklist-management) (P1)
12. [Scryfall Integration](#12-scryfall-integration) (P1)
13. [Dashboard](#13-dashboard) (P1)
14. [Player Profiles](#14-player-profiles) (P1)
15. [Discord Webhook Notifications](#15-discord-webhook-notifications) (P2)
16. [In-App Notifications](#16-in-app-notifications) (P2)
17. [Data Export](#17-data-export) (P2)
18. [Career Stats & History](#18-career-stats--history) (P2)
19. [Admin Dashboard](#19-admin-dashboard) (P2)
20. [Card Trading](#20-card-trading) (P2)

---

## 1. User Authentication

**Priority:** P0
**Dependencies:** None

### Description

OAuth-based authentication using Discord (primary) and Google (secondary). Non-logged-in visitors get a public spectator view with access to standings and recent results.

### User Stories

- As a player, I want to sign in with my Discord account so that I don't need to create a separate username/password.
- As a visitor, I want to view standings and recent results without logging in so I can follow the league.
- As a player, I want my display name and avatar to be pulled from my OAuth provider.

### Acceptance Criteria

- [ ] Users can authenticate via Discord OAuth 2.0
- [ ] Users can authenticate via Google OAuth 2.0
- [ ] A new User record is created on first login with discordId/googleId, displayName, avatar, and auto-generated slug
- [ ] Returning users are matched by their OAuth provider ID
- [ ] JWT token is issued on successful auth and used for subsequent API requests
- [ ] Public pages (standings, schedule, recent results) are accessible without authentication
- [ ] Authenticated endpoints return 401 for missing/invalid tokens
- [ ] User slug is unique and URL-safe (for profile URLs)

---

## 2. League & Season Management

**Priority:** P0
**Dependencies:** #1

### Description

CRUD operations for leagues and seasons. Leagues have branding (name, logo, banner), privacy settings, and clean slug-based URLs. Seasons are fully independent units within a league.

### User Stories

- As an admin, I want to create a league with a name, description, and logo so our group has an identity.
- As an admin, I want to configure whether card pools and decklists are visible to all players.
- As an admin, I want to create new seasons that start fresh with no carryover.
- As a player, I want to navigate to my league via a clean URL like `/league/friday-night`.

### Acceptance Criteria

- [ ] Admin can create a league with name, slug, description, logoUrl, bannerUrl
- [ ] League slug is unique and used in URLs
- [ ] Admin can configure privacy: poolVisibility, decklistVisibility, scheduleVisibility
- [ ] Admin can create seasons within a league, each with a name and number
- [ ] Only one season can be active at a time per league
- [ ] Seasons are fully independent — no data carries over
- [ ] Admin can toggle trading enabled/disabled per season
- [ ] All league/season pages use slug-based URLs

---

## 3. Booster Product & Set Configuration

**Priority:** P0
**Dependencies:** #2, #12

### Description

Each player selects their own booster product at season start. The system maps booster products to Scryfall set codes, restricting card search to valid printings. The booster-to-set-code mapping is a known complexity.

### User Stories

- As an admin, I want to create booster product entries (e.g., "OTJ Play Booster") and map them to set codes (OTJ, OTP, BIG).
- As a player, I want to select my booster product at the start of a season so the app knows which cards I can open.
- As a player, I want card search to only show cards from my booster product's set codes.

### Acceptance Criteria

- [ ] Admin can create BoosterProduct with name, set release name, and type (draft/play/set/collector)
- [ ] Admin can add multiple set codes to a booster product
- [ ] Players select a booster product when creating their card pool for a season
- [ ] Card search is restricted to the set codes of the player's selected booster product
- [ ] Booster products are global (not per-league) and reusable across seasons

### Open Questions

- Booster-to-set-code mapping may need a community-maintained data file since no public API provides this

---

## 4. Event Management

**Priority:** P0
**Dependencies:** #2

### Description

Events are tournament units within a season. Each event has its own format, rules, and scoring configuration. Supports Swiss, Seeded Swiss, and Round Robin formats, plus special exhibition events.

### User Stories

- As an admin, I want to create an event and configure its format, match structure, and deck rules.
- As an admin, I want to create a special exhibition event with double points or standings override.
- As a player, I want to see the current event's format and rules.

### Acceptance Criteria

- [ ] Admin can create events within a season with name and order index
- [ ] EventConfig supports: format (swiss/seeded_swiss/round_robin), bestOfN, deckCount, minDeckSize, sideboardRule, schedulingType, deckLockingMode, seedingSource
- [ ] Event lifecycle: setup → active → completed
- [ ] Only one event can be active at a time per league
- [ ] Events support pointMultiplier (default 1.0) for special scoring
- [ ] Events support standingsOverride flag (final event replaces cumulative standings)
- [ ] Admin can transition events between states

---

## 5. Match Reporting

**Priority:** P0
**Dependencies:** #4

### Description

Either player reports game-level results for a match. The opponent confirms or disputes. Disputed matches are escalated to admin. Byes are handled automatically.

### User Stories

- As a player, I want to report my match results with game-by-game outcomes.
- As a player, I want to confirm or dispute my opponent's reported results.
- As an admin, I want to resolve disputed matches with the correct results.

### Acceptance Criteria

- [ ] Match states: pending → reported → confirmed/disputed → resolved
- [ ] Either player1 or player2 can submit GameResult entries (game number, winner, optional notes)
- [ ] The opponent can confirm (→ confirmed) or dispute (→ disputed) the report
- [ ] Disputed matches appear in admin's dispute queue
- [ ] Admin can override and resolve any match
- [ ] Bye matches auto-confirm with configurable game score
- [ ] Match confirmation triggers standings recomputation
- [ ] Only the two involved players (or admin) can interact with a match

---

## 6. Standings & Points

**Priority:** P0
**Dependencies:** #5, #7

### Description

Fully configurable point system with auto-calculated standings. Always visible to all users with full tiebreaker detail.

### User Stories

- As a player, I want to see current standings with my rank, points, and tiebreakers.
- As an admin, I want to configure how many points are awarded for wins, draws, losses, and bonuses.
- As a spectator, I want to view standings without logging in.

### Acceptance Criteria

- [ ] PointConfig per season: matchWinPoints, matchDrawPoints, matchLossPoints, gameWinPoints, sweepBonusPoints
- [ ] Standings display: rank, player name, points, record (W-L-D), OMW%, GW%, OGW%
- [ ] Standings are eagerly recomputed on every match confirmation/resolution
- [ ] Standings are always publicly visible
- [ ] Standings respect event pointMultiplier
- [ ] Standings sort by: points DESC, then OMW% DESC, then GW% DESC, then OGW% DESC

---

## 7. Tiebreaker Calculation

**Priority:** P0
**Dependencies:** #5

### Description

Standard MTG tournament tiebreakers: OMW%, GW%, OGW%. Bye impact handled correctly.

### User Stories

- As a player, I want tiebreakers calculated the same way official MTG tournaments do.
- As a player, I want byes to not unfairly inflate or deflate my tiebreakers.

### Acceptance Criteria

- [ ] OMW% = average of each opponent's match win percentage (minimum 33% floor per opponent)
- [ ] GW% = player's game wins / total games played (minimum 33% floor)
- [ ] OGW% = average of each opponent's game win percentage
- [ ] Byes: the "missing opponent" counts as having a 33% match win rate for OMW% calculation
- [ ] Tiebreakers are recalculated whenever standings are recomputed
- [ ] All percentages displayed as two decimal places

---

## 8. Tournament Pairing

**Priority:** P1
**Dependencies:** #4, #6

### Description

Three pairing systems: Swiss, Seeded Swiss, and Round Robin. Round Robin can span multiple events with a pre-generated master schedule.

### User Stories

- As an admin, I want to generate Swiss pairings based on current standings.
- As an admin, I want to generate Seeded Swiss pairings where round 1 is seeded by prior results.
- As an admin, I want the system to pre-generate a full round-robin schedule across multiple events.
- As an admin, I want to regenerate a round's pairings if a correction is needed.

### Acceptance Criteria

- [x] Swiss: pair players with the same or similar record, avoiding repeat pairings when possible
- [x] Seeded Swiss: round 1 seeded by configurable source (previous_season, previous_event, manual); subsequent rounds use Swiss
- [ ] Round Robin: generate all-play-all schedule at season start, distribute across multiple events (3-4 rounds each)
- [ ] Round Robin schedule visibility is configurable per league
- [x] Admin can regenerate pairings for a round that hasn't started
- [x] Odd number of players: assign a bye to the lowest-ranked player without a prior bye

---

## 9. Player Drops

**Priority:** P1
**Dependencies:** #8

### Description

Players can drop from a season or event. The system handles the impact on pairings.

### User Stories

- As a player, I want to drop from the league if I can no longer participate.
- As an admin, I want to drop a player and have future pairings adjusted automatically.

### Acceptance Criteria

- [ ] Admin can drop a player from the current season/event
- [ ] For Swiss: dropped player is excluded from future round pairings
- [ ] For Round Robin: system attempts to rebalance remaining pairings
- [ ] If Round Robin rebalancing fails, admin can manually adjust
- [ ] Dropped player's existing results remain in standings
- [ ] Opponents who were scheduled against a dropped player in future rounds receive byes

---

## 10. Card Pool Tracking

**Priority:** P1
**Dependencies:** #3, #12

### Description

Track each player's card pool for a season. Pools grow through acquisition phases. Card entry supports manual search, bulk paste, and (future) camera scanning.

### User Stories

- As a player, I want to add cards to my pool after opening new packs.
- As a player, I want to see my full pool organized by acquisition phase.
- As a player, I want to search for cards restricted to my booster product's sets.
- As an admin, I want to configure whether pool additions require approval.

### Acceptance Criteria

- [ ] Each player has one CardPool per season, linked to their chosen BoosterProduct
- [ ] Cards are added via PoolAcquisitions with a phase label and date
- [ ] Card entry methods: manual search with autocomplete, bulk text paste (MTGO/Arena format)
- [ ] Camera scan documented as stretch goal only
- [ ] Card search restricted to the player's booster product set codes
- [ ] Pool verification configurable: honor_system, admin_approval, peer_approval
- [ ] Pool viewer: visual card grid and sortable list view
- [ ] Filter bar: color, type, rarity, mana value, acquisition phase
- [ ] Pool visibility respects league privacy settings

---

## 11. Decklist Management

**Priority:** P1
**Dependencies:** #10, #12

### Description

Full-featured deck builder inspired by Moxfield and CubeCobra, tailored for sealed-pool deckbuilding. Decklists are scoped to event + round. Each round can have a distinct deck. Players can import from a previous round's decklist as a starting point.

### User Stories

- As a player, I want to build a deck from my card pool with a visual interface like Moxfield.
- As a player, I want to import my previous round's decklist as a starting point for the next round.
- As a player, I want to see how many copies of each card I have available across all my decks.
- As a player, I want to export my decklist in MTGO/Arena/Moxfield format.

### Acceptance Criteria

- [ ] Four view modes: Visual Stacks, Visual Grid, List/Table, Pile View
- [ ] Grouping by: card type, mana value, color, rarity, custom tags, acquisition phase
- [ ] Sorting within groups: by name, mana value, color, rarity
- [ ] Card adding: search-from-pool autocomplete, visual pool browse, bulk text paste
- [ ] Pool awareness: "X of Y available" display, grayed out when fully allocated across all decks
- [ ] Multi-deck events: tabbed interface, shared pool availability across decks
- [ ] Pool access panel: slide-out drawer or split-view (desktop), toggle between pool/deck view (mobile)
- [ ] Card hover preview (desktop), click opens detail panel with full card info
- [ ] Drag-and-drop between main/sideboard/piles (desktop), button/menu fallback (mobile)
- [ ] User-adjustable card image size slider
- [ ] Deck stats: mana curve, color distribution, type breakdown, total card count, average mana value
- [ ] Strict pool validation -- cannot add cards beyond pool count (basic lands exempt)
- [ ] Deck size validation against event minimum (default 40)
- [ ] Deck uniqueness validation when event has DeckUniquenessRule
- [ ] Sideboard validation per event config (entire_pool, fixed_15, none)
- [ ] Export: MTGO, Arena, Moxfield text formats
- [ ] Decklist privacy follows league settings
- [ ] Decklist states: draft → submitted → locked
- [ ] "Import from previous round" copies a prior decklist as starting point
- [ ] Deck locking configurable per event (required_before_round, free_modification, admin_locked)

### Previous-round league deck archive

Players and spectators can browse other players’ decks from completed previous rounds on `/decks`. Registered (`submitted`/`locked`) lists are the official source of truth. Leftover created (`draft`) decks for a completed round are still listed so the league can see what someone built even if they never hit Register. Other players’ in-progress current-round drafts stay private.

#### User Stories

- As a player, I want to browse other players’ previous-round decks on `/decks` so I can see what the league played.
- As a spectator, I want the same archive when season decklist visibility is on.
- As a player who never hit Register, I still want my leftover created deck visible after the round completes so the league can see what I built.
- As a player, I do not want others to see my in-progress current-round draft.

#### Acceptance Criteria

- [x] Logged-in `/decks` loads the season visible-decklist list, not only `my-season`
- [x] Archive grouping is event → round → player; registered decks appear before unregistered created decks
- [x] Registered (`submitted`/`locked`) decks are badged Registered and treated as the official list
- [x] After a round is `completed`, other players’ leftover `draft` decks for that round are listed and labeled Unregistered
- [x] Players who never registered still appear if they have a created deck for that previous round
- [x] Other players’ drafts for the current in-progress / not-started round are omitted from the list and `GET /api/decklists/:id` returns 403
- [x] Completed earlier rounds of an active event appear in the archive
- [x] Opening an archive row succeeds (`GET /api/decklists/:id` uses the same visibility predicate as the list)
- [x] Viewing another player’s deck is read-only; the owner still edits in the existing builder
- [x] When `decklistVisibility` is off, other members and spectators see no archive (owner and site admin excepted)
- [x] `GET /api/events/:eventId/decklists` applies the same visibility filter
- [x] Profile “Browse Decklists” opens `/decks?player=:slug` when decklists are visible
- [x] Expanded archive row defaults to a hoverable Main/Sideboard list (`DeckCardList` / `HoverTarget`); List/Details toggle opens read-only curve/stacks; no Register, Unregister, or Enable editing
- [x] `/decks?player=:slug` heading is `{primaryName}'s decklists` (fallback `This player's decklists`) and hides Open Current Deckbuilder, including the signed-in user's own slug
- [x] Expanded archive cards use the same hover preview as pools; season list does not add `imageUris`

### Planned for Later

- Deck-level description/primer notes
- Per-card notes (why a card is included)
- Sample hand / playtest (draw 7, mulligan, goldfish)

---

## 12. Scryfall Integration

**Priority:** P1
**Dependencies:** None

### Description

Integration with the Scryfall API for card data including images, oracle text, mana costs, types, rarity, and pricing. All card data is cached locally in the CachedCard table to respect rate limits.

### User Stories

- As a player, I want card search to show card images, names, and details with autocomplete.
- As the system, I want to cache card data locally to stay within Scryfall's 10 req/s rate limit.
- As an admin, I want bulk card data loading when setting up a new season.

### Acceptance Criteria

- [ ] Card search endpoint with autocomplete, filtered by set codes
- [ ] CachedCard table stores: scryfallId, name, manaCost, typeLine, oracleText, colors, colorIdentity, cmc, rarity, setCode, imageUris, prices, lastFetched
- [ ] Card data refreshed on configurable interval (weekly for data, daily for prices)
- [ ] Scryfall rate limit of 10 requests/second respected with queuing
- [ ] Bulk data endpoint used for large imports (new season setup, full set loads)
- [ ] Card images served via Scryfall CDN URLs stored in imageUris JSON field
- [ ] Search supports fuzzy matching and returns results ranked by relevance

---

## 13. Dashboard

**Priority:** P1
**Dependencies:** #1, #5, #6

### Description

The main landing page showing contextual league information. Logged-in players see personalized data; spectators see public standings and results.

### User Stories

- As a player, I want to see my next match, current standings, and recent results at a glance.
- As a spectator, I want to see current standings and recent results without logging in.

### Acceptance Criteria

- [ ] Logged-in view: next match (opponent, deadline, quick-report button), current standings snapshot, recent results, season overview (event progress, personal record, pool size)
- [ ] Spectator view: current standings table and recent match results
- [ ] Dashboard loads with minimal API calls (aggregated endpoint or parallel fetches)
- [ ] Responsive layout: widgets stack on mobile, grid on desktop

---

## 14. Player Profiles

**Priority:** P1
**Dependencies:** #1, #6

### Description

Public profile pages showing a player's current and historical performance across seasons.

### User Stories

- As a player, I want to view my own and other players' profiles with career history.
- As a player, I want to see match history and links to decklists.

### Acceptance Criteria

- [ ] Profile page at `/profile/:slug` with clean URL
- [ ] Displays: display name, avatar, current season record and standing
- [ ] Career history: list of past seasons with final records and standings
- [ ] Match log: recent matches with results and opponents
- [ ] Links to decklists and card pool (respecting privacy settings)
- [x] Profile decklist link is player-scoped (`/decks?player=:slug`) and still respects season privacy
- [ ] Publicly viewable by all visitors

---

## 15. Discord Webhook Notifications

**Priority:** P2
**Dependencies:** #5, #6

### Description

Automated messages posted to a configured Discord channel via webhooks for key league events.

### User Stories

- As an admin, I want league events automatically posted to our Discord server.
- As a player, I want to see match results and standings updates in Discord.

### Acceptance Criteria

- [ ] Admin configures a Discord webhook URL per league
- [ ] Webhook posts for: round start, match results, updated standings, season milestones
- [ ] Messages formatted with Discord embeds (player names, scores, standings table)
- [ ] Webhook failures logged but never block app operations
- [ ] Rate limiting to avoid Discord webhook rate limits

---

## 16. In-App Notifications

**Priority:** P2
**Dependencies:** #1, #5, #8

### Description

In-app notification system to alert players about events requiring their attention.

### User Stories

- As a player, I want to be notified when my opponent reports results so I can confirm or dispute.
- As a player, I want to be reminded about upcoming round deadlines.

### Acceptance Criteria

- [ ] Notification types: match_pending, round_start, deadline_warning, result_confirmed, pool_growth
- [ ] Per-user notifications with read/unread status
- [ ] Notification bell icon in navbar with unread count badge
- [ ] Each notification links to the relevant page (match, round, pool)
- [ ] Notifications auto-created by system events (match report, round start, etc.)

---

## 17. Data Export

**Priority:** P2
**Dependencies:** #6, #11

### Description

Export league data in common formats for record-keeping and external use.

### User Stories

- As an admin, I want to export standings and results to CSV for record-keeping.
- As a player, I want to export my decklist to paste into MTGO or Arena.

### Acceptance Criteria

- [ ] Export standings to CSV: rank, player, points, record (W-L-D), OMW%, GW%, OGW%
- [ ] Export match results to CSV: round, player1, player2, game results, match winner
- [ ] Export decklists in MTGO, Arena, and Moxfield text formats
- [ ] Exports respect privacy settings (only export data the user can view)

---

## 18. Career Stats & History

**Priority:** P2
**Dependencies:** #6, #14

### Description

Archive past seasons and aggregate career statistics across a player's entire history.

### User Stories

- As a player, I want to see my all-time win rate and total matches played.
- As a player, I want to browse past seasons with their final standings.

### Acceptance Criteria

- [ ] Past seasons archived as read-only with full standings preserved
- [ ] Career stats: total seasons played, total matches, overall win rate, total W-L-D
- [ ] Schema supports future detailed analytics: head-to-head records, color stats, win streaks
- [ ] Career stats displayed on player profile page

---

## 19. Admin Dashboard

**Priority:** P2
**Dependencies:** #1, #2, #4, #5

### Description

Centralized admin interface for all league management operations.

### User Stories

- As an admin, I want a single place to manage all league operations.
- As an admin, I want to batch-enter results for all matches in a round at once.
- As an admin, I want to see and resolve all pending match disputes.

### Acceptance Criteria

- [ ] League branding settings: name, slug, logo, banner, privacy toggles
- [ ] Player management: view members, change roles (admin/player), remove players
- [ ] Invite link generation: create with optional expiration and max uses, revoke
- [ ] Season and event creation and configuration
- [ ] Batch result entry: enter all match results for a round in one form
- [ ] Manual result override for any match regardless of state
- [ ] Dispute resolution queue showing all disputed matches
- [ ] Pool management: view, approve, or reject pool acquisitions
- [ ] Batch player operations: drop multiple players, send announcements

---

## 20. Card Trading

**Priority:** P2
**Dependencies:** #10

### Description

Optional card trading between player pools, configurable per league/season. Disabled by default.

### User Stories

- As a player, I want to trade cards with another player in my league when trading is enabled.
- As an admin, I want to view a history of all trades in the league.
- As an admin, I want to enable or disable trading per season.

### Acceptance Criteria

- [ ] Trading toggle per season (off by default via Season.tradingEnabled)
- [ ] Player initiates a trade: select cards to offer and cards to request from the other player
- [ ] Both parties must confirm the trade before it executes
- [ ] On acceptance, CardPoolEntries move between pools (tracked via Trade entity)
- [ ] Trade history viewable by admin
- [ ] Trade states: proposed → accepted | rejected | cancelled
- [ ] Trading only allowed between events (disabled during active events)
