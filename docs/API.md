# API Documentation

## Base URL

```
/api
```

All endpoints are prefixed with `/api`. Examples in this document show full paths.

---

## Authentication

- Auth is via **JWT Bearer token** in the `Authorization` header:
  ```
  Authorization: Bearer <token>
  ```
- Tokens are obtained through the OAuth login flow (Discord or Google).
- **Public** endpoints are accessible without authentication.
- **Authenticated** endpoints require a valid JWT.
- **Admin** endpoints require the authenticated user to have an admin role for the relevant league.
- Some endpoints support **optional auth** — they return additional data when a valid token is provided.

---

## Error Format

All endpoints return errors in a consistent shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description of what went wrong"
  }
}
```

Validation errors include a `fields` object mapping field names to error messages:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "fields": {
      "name": "Name is required",
      "maxPlayers": "Must be a positive integer"
    }
  }
}
```

---

## Error Codes

| Code                    | HTTP Status | Description                                    |
| ----------------------- | ----------- | ---------------------------------------------- |
| `UNAUTHORIZED`          | 401         | Missing or invalid token                       |
| `FORBIDDEN`             | 403         | Insufficient permissions for this action       |
| `NOT_FOUND`             | 404         | Resource not found                             |
| `VALIDATION_ERROR`      | 400         | Invalid request data (includes `fields` object)|
| `CONFLICT`              | 409         | Resource conflict (e.g., duplicate slug)       |
| `RATE_LIMITED`          | 429         | Too many requests                              |
| `INTERNAL_SERVER_ERROR` | 500         | Unexpected server error                        |

---

## Endpoints

### Auth (`/api/auth`)

#### `GET /api/auth/discord`

Initiate Discord OAuth2 login flow.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Response | `302` redirect to Discord authorization URL |

---

#### `GET /api/auth/discord/callback`

Handle Discord OAuth2 callback. Creates or updates the user account and issues a JWT.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Query Params | `code` (string) — OAuth authorization code |
| Success  | `302` redirect to app with `token` cookie set |
| Error    | `302` redirect to `/login?error=OAUTH_FAILED` |

---

#### `GET /api/auth/google`

Initiate Google OAuth2 login flow.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Response | `302` redirect to Google authorization URL |

---

#### `GET /api/auth/google/callback`

Handle Google OAuth2 callback. Creates or updates the user account and issues a JWT.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Query Params | `code` (string) — OAuth authorization code |
| Success  | `302` redirect to app with `token` cookie set |
| Error    | `302` redirect to `/login?error=OAUTH_FAILED` |

---

#### `GET /api/auth/me`

Return the currently authenticated user.

| Property | Value |
|----------|-------|
| Auth     | Authenticated |

**Response `200`:**

```json
{
  "id": "clx1abc23def456",
  "slug": "wizardplayer42",
  "displayName": "WizardPlayer42",
  "avatarUrl": "https://cdn.example.com/avatars/abc.png",
  "email": "player@example.com",
  "role": "user",
  "createdAt": "2026-01-15T08:30:00Z"
}
```

---

#### `POST /api/auth/logout`

Invalidate the current session / clear the auth cookie.

| Property | Value |
|----------|-------|
| Auth     | Authenticated |

**Response `200`:**

```json
{ "success": true }
```

---

### Leagues (`/api/leagues`)

#### `GET /api/leagues`

List all leagues. Supports pagination and filtering.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Query Params | `page` (int, default 1), `limit` (int, default 20), `search` (string, optional) |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clx1abc23def456",
      "slug": "friday-night-box-league",
      "name": "Friday Night Box League",
      "description": "Weekly sealed league for our LGS crew",
      "memberCount": 12,
      "activeSeason": {
        "number": 3,
        "name": "Season 3 — Outlaws of Thunder Junction"
      },
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

#### `POST /api/leagues`

Create a new league. The authenticated user becomes the league's first admin.

| Property | Value |
|----------|-------|
| Auth     | Authenticated |

**Request Body:**

```json
{
  "name": "Friday Night Box League",
  "description": "Weekly sealed league for our LGS crew",
  "slug": "friday-night-box-league"
}
```

| Field         | Type   | Required | Notes                              |
| ------------- | ------ | -------- | ---------------------------------- |
| `name`        | string | yes      | 3–100 characters                   |
| `description` | string | no       | Max 500 characters                 |
| `slug`        | string | no       | Auto-generated from name if absent. Lowercase, alphanumeric + hyphens. |

**Response `201`:**

```json
{
  "id": "clx1abc23def456",
  "slug": "friday-night-box-league",
  "name": "Friday Night Box League",
  "description": "Weekly sealed league for our LGS crew",
  "ownerId": "clxuser789",
  "createdAt": "2026-04-30T05:00:00Z"
}
```

**Errors:** `VALIDATION_ERROR`, `CONFLICT` (slug taken)

---

#### `GET /api/leagues/:slug`

Get league details by slug.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Params   | `slug` (string) — league slug |

**Response `200`:**

```json
{
  "id": "clx1abc23def456",
  "slug": "friday-night-box-league",
  "name": "Friday Night Box League",
  "description": "Weekly sealed league for our LGS crew",
  "ownerId": "clxuser789",
  "memberCount": 12,
  "poolVisibility": true,
  "decklistVisibility": true,
  "scheduleVisibility": true,
  "activeSeason": {
    "number": 3,
    "name": "Season 3 — Outlaws of Thunder Junction",
    "status": "active"
  },
  "createdAt": "2026-01-01T00:00:00Z"
}
```

**Errors:** `NOT_FOUND`

---

#### `PATCH /api/leagues/:slug`

Update league settings. Only accessible by league admins.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `slug` (string) — league slug |

**Request Body (all fields optional):**

```json
{
  "name": "Updated League Name",
  "description": "New description"
}
```

**Response `200`:** Updated league object (same shape as `GET /api/leagues/:slug`).

**Errors:** `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`

---

#### `DELETE /api/leagues/:slug`

Delete a league and all associated data.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `slug` (string) — league slug |

**Response `200`:**

```json
{ "success": true }
```

**Errors:** `FORBIDDEN`, `NOT_FOUND`

---

#### `GET /api/leagues/:slug/members`

List all members of a league with their roles.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Params   | `slug` (string) — league slug |

**Response `200`:**

```json
{
  "data": [
    {
      "userId": "clxuser789",
      "displayName": "WizardPlayer42",
      "slug": "wizardplayer42",
      "avatarUrl": "https://cdn.example.com/avatars/abc.png",
      "role": "admin",
      "joinedAt": "2026-01-01T00:00:00Z"
    },
    {
      "userId": "clxuser456",
      "displayName": "GoblinFan99",
      "slug": "goblinfan99",
      "avatarUrl": null,
      "role": "member",
      "joinedAt": "2026-01-05T12:00:00Z"
    }
  ]
}
```

---

#### `POST /api/leagues/:slug/join`

Join a league using an invite token.

| Property | Value |
|----------|-------|
| Auth     | Authenticated |
| Params   | `slug` (string) — league slug |

**Request Body:**

```json
{
  "inviteToken": "abc123xyz"
}
```

**Response `200`:**

```json
{
  "success": true,
  "league": {
    "slug": "friday-night-box-league",
    "name": "Friday Night Box League"
  }
}
```

**Errors:** `UNAUTHORIZED`, `NOT_FOUND`, `CONFLICT` (already a member), `VALIDATION_ERROR` (invalid/expired token)

---

### Invite Links (`/api/leagues/:slug/invites`)

#### `GET /api/leagues/:slug/invites`

List all invite links for a league.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `slug` (string) — league slug |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clxinv001",
      "token": "abc123xyz",
      "label": "Discord share link",
      "usesRemaining": 8,
      "maxUses": 10,
      "expiresAt": "2026-05-30T00:00:00Z",
      "createdAt": "2026-04-01T00:00:00Z"
    }
  ]
}
```

---

#### `POST /api/leagues/:slug/invites`

Create a new invite link.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `slug` (string) — league slug |

**Request Body:**

```json
{
  "label": "Discord share link",
  "maxUses": 10,
  "expiresInDays": 30
}
```

| Field          | Type   | Required | Notes                                      |
| -------------- | ------ | -------- | ------------------------------------------ |
| `label`        | string | no       | Human-friendly label                       |
| `maxUses`      | int    | no       | `null` for unlimited                       |
| `expiresInDays`| int    | no       | `null` for never expires                   |

**Response `201`:** Invite object (same shape as list item above).

---

#### `DELETE /api/leagues/:slug/invites/:id`

Revoke an invite link immediately.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `slug` (string), `id` (string) — invite link ID |

**Response `200`:**

```json
{ "success": true }
```

**Errors:** `FORBIDDEN`, `NOT_FOUND`

---

#### `GET /api/invites/:token`

Validate an invite token and return basic league info. Used by the join page to show league details before the user confirms.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Params   | `token` (string) — invite token |

**Response `200`:**

```json
{
  "valid": true,
  "league": {
    "slug": "friday-night-box-league",
    "name": "Friday Night Box League",
    "memberCount": 12
  }
}
```

**Response `200` (invalid token):**

```json
{
  "valid": false,
  "reason": "expired"
}
```

---

### Seasons (`/api/leagues/:slug/seasons`)

#### `GET /api/leagues/:slug/seasons`

List all seasons for a league.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Params   | `slug` (string) — league slug |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clxseason01",
      "number": 3,
      "name": "Season 3 — Outlaws of Thunder Junction",
      "status": "active",
      "startDate": "2026-04-01T00:00:00Z",
      "endDate": null,
      "playerCount": 12,
      "eventCount": 4
    },
    {
      "id": "clxseason00",
      "number": 2,
      "name": "Season 2 — Murders at Karlov Manor",
      "status": "completed",
      "startDate": "2026-01-01T00:00:00Z",
      "endDate": "2026-03-31T00:00:00Z",
      "playerCount": 10,
      "eventCount": 6
    }
  ]
}
```

---

#### `POST /api/leagues/:slug/seasons`

Create a new season.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `slug` (string) — league slug |

**Request Body:**

```json
{
  "name": "Season 4 — Tarkir Dragonstorm",
  "boosterProductIds": ["clxprod001", "clxprod002"],
  "initialPoolSize": 6,
  "additionsPerEvent": 1,
  "startDate": "2026-07-01T00:00:00Z"
}
```

| Field                | Type     | Required | Notes                                          |
| -------------------- | -------- | -------- | ---------------------------------------------- |
| `name`               | string   | yes      | Season display name                            |
| `boosterProductIds`  | string[] | yes      | Which booster products players open             |
| `initialPoolSize`    | int      | yes      | Number of packs for initial sealed pool         |
| `additionsPerEvent`  | int      | no       | Packs added per event (default 0)              |
| `startDate`          | datetime | no       | Scheduled start date                           |

**Response `201`:** Season object.

**Errors:** `FORBIDDEN`, `VALIDATION_ERROR`

---

#### `GET /api/leagues/:slug/seasons/:number`

Get season details by season number.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Params   | `slug` (string), `number` (int) — season number |

**Response `200`:**

```json
{
  "id": "clxseason01",
  "number": 3,
  "name": "Season 3 — Outlaws of Thunder Junction",
  "status": "active",
  "boosterProducts": [
    { "id": "clxprod001", "name": "Outlaws of Thunder Junction Play Booster", "setCodes": ["OTJ"] },
    { "id": "clxprod002", "name": "The Big Score Collector Booster", "setCodes": ["BIG"] }
  ],
  "initialPoolSize": 6,
  "additionsPerEvent": 1,
  "startDate": "2026-04-01T00:00:00Z",
  "endDate": null,
  "playerCount": 12,
  "events": [
    { "id": "clxevt001", "name": "Week 1", "status": "completed" },
    { "id": "clxevt002", "name": "Week 2", "status": "active" }
  ]
}
```

---

#### `PATCH /api/leagues/:slug/seasons/:number`

Update season settings.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `slug` (string), `number` (int) — season number |

**Request Body (all fields optional):**

```json
{
  "name": "Updated Season Name",
  "additionsPerEvent": 2,
  "status": "completed"
}
```

**Response `200`:** Updated season object.

**Errors:** `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`

---

### Events (`/api/seasons/:seasonId/events`)

#### `GET /api/seasons/:seasonId/events`

List all events in a season.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Params   | `seasonId` (string) |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clxevt001",
      "name": "Week 1",
      "status": "completed",
      "orderIndex": 1,
      "config": {},
      "rounds": [
        { "id": "w1-r1", "roundNumber": 1, "status": "completed" },
        { "id": "w1-r2", "roundNumber": 2, "status": "completed" }
      ]
    }
  ]
}
```

Each `rounds` entry includes `id`, `roundNumber`, and `status` so the `/decks` archive can fan official event lists under completed-round headings.

---

#### `POST /api/seasons/:seasonId/events`

Create a new event.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `seasonId` (string) |

**Request Body:**

```json
{
  "name": "Week 3",
  "format": "sealed",
  "bestOf": 3,
  "roundCount": 3,
  "pairingAlgorithm": "swiss",
  "scheduledDate": "2026-04-21T19:00:00Z",
  "additionPacks": 1
}
```

| Field               | Type   | Required | Notes                                          |
| ------------------- | ------ | -------- | ---------------------------------------------- |
| `name`              | string | yes      | Event display name                             |
| `format`            | string | yes      | `sealed` or `constructed`                      |
| `bestOf`            | int    | no       | Games per match (default 3)                    |
| `roundCount`        | int    | yes      | Expected number of rounds                      |
| `pairingAlgorithm`  | string | no       | `swiss` (default), `random`, `round-robin`     |
| `scheduledDate`     | datetime | no     | When the event is scheduled                    |
| `additionPacks`     | int    | no       | Packs to add to pools for this event           |

**Response `201`:** Event object.

---

#### `GET /api/events/:eventId`

Get event details including configuration.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Params   | `eventId` (string) |

**Response `200`:**

```json
{
  "id": "clxevt002",
  "name": "Week 2",
  "status": "active",
  "format": "sealed",
  "bestOf": 3,
  "roundCount": 3,
  "pairingAlgorithm": "swiss",
  "scheduledDate": "2026-04-14T19:00:00Z",
  "additionPacks": 1,
  "currentRound": 2,
  "playerCount": 12,
  "seasonId": "clxseason01"
}
```

---

#### `PATCH /api/events/:eventId`

Update event settings. Only allowed while event is in `setup` status.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `eventId` (string) |

**Response `200`:** Updated event object.

**Errors:** `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT` (event already started)

---

#### `POST /api/events/:eventId/start`

Transition event from `setup` to `active`. Validates all prerequisites (e.g., enough players, card pools submitted).

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `eventId` (string) |

**Response `200`:**

```json
{
  "success": true,
  "event": { "id": "clxevt002", "status": "active" }
}
```

**Errors:** `FORBIDDEN`, `CONFLICT` (invalid state transition), `VALIDATION_ERROR` (prerequisites not met)

---

#### `POST /api/events/:eventId/complete`

Mark event as completed. Finalizes standings and calculates points.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `eventId` (string) |

**Response `200`:**

```json
{
  "success": true,
  "event": { "id": "clxevt002", "status": "completed" }
}
```

**Errors:** `FORBIDDEN`, `CONFLICT` (rounds still in progress)

---

### Rounds (`/api/events/:eventId/rounds`)

#### `GET /api/events/:eventId/rounds`

List all rounds in an event.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Params   | `eventId` (string) |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clxrnd001",
      "number": 1,
      "status": "completed",
      "matchCount": 6,
      "startedAt": "2026-04-14T19:05:00Z",
      "completedAt": "2026-04-14T20:15:00Z"
    },
    {
      "id": "clxrnd002",
      "number": 2,
      "status": "active",
      "matchCount": 6,
      "startedAt": "2026-04-14T20:20:00Z",
      "completedAt": null
    }
  ]
}
```

---

#### `POST /api/events/:eventId/rounds`

Create and generate pairings for the next round using the event's configured pairing algorithm.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `eventId` (string) |

**Response `201`:**

```json
{
  "id": "clxrnd003",
  "number": 3,
  "status": "pending",
  "matches": [
    {
      "id": "clxmatch010",
      "player1": { "id": "clxuser001", "displayName": "WizardPlayer42" },
      "player2": { "id": "clxuser002", "displayName": "GoblinFan99" },
      "table": 1
    }
  ]
}
```

**Errors:** `FORBIDDEN`, `CONFLICT` (previous round not completed)

---

#### `GET /api/rounds/:roundId`

Get round details including all matches.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Params   | `roundId` (string) |

**Response `200`:**

```json
{
  "id": "clxrnd002",
  "number": 2,
  "status": "active",
  "eventId": "clxevt002",
  "matches": [
    {
      "id": "clxmatch007",
      "table": 1,
      "status": "reported",
      "player1": { "id": "clxuser001", "displayName": "WizardPlayer42" },
      "player2": { "id": "clxuser002", "displayName": "GoblinFan99" },
      "reportedBy": "clxuser001",
      "result": { "player1Wins": 2, "player2Wins": 1, "draws": 0 }
    },
    {
      "id": "clxmatch008",
      "table": 2,
      "status": "pending",
      "player1": { "id": "clxuser003", "displayName": "SnapcasterMage" },
      "player2": { "id": "clxuser004", "displayName": "BoltTheBird" },
      "reportedBy": null,
      "result": null
    }
  ],
  "startedAt": "2026-04-14T20:20:00Z",
  "completedAt": null
}
```

---

#### `POST /api/rounds/:roundId/start`

Start a round (transition from `pending` to `active`).

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `roundId` (string) |

**Response `200`:**

```json
{
  "success": true,
  "round": { "id": "clxrnd003", "status": "active" }
}
```

---

#### `POST /api/rounds/:roundId/complete`

Complete a round. All matches must be confirmed or resolved first.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `roundId` (string) |

**Response `200`:**

```json
{
  "success": true,
  "round": { "id": "clxrnd002", "status": "completed" }
}
```

**Errors:** `FORBIDDEN`, `CONFLICT` (unresolved matches remain)

---

#### `POST /api/rounds/:roundId/regenerate`

Regenerate pairings for a round. Only allowed while the round is in `pending` status.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `roundId` (string) |

**Response `200`:** Round object with new matches (same shape as `GET /api/rounds/:roundId`).

**Errors:** `FORBIDDEN`, `CONFLICT` (round already started)

---

### Matches (`/api/matches`)

#### `GET /api/rounds/:roundId/matches`

List all matches in a round.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Params   | `roundId` (string) |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clxmatch007",
      "table": 1,
      "status": "confirmed",
      "player1": { "id": "clxuser001", "displayName": "WizardPlayer42" },
      "player2": { "id": "clxuser002", "displayName": "GoblinFan99" },
      "result": { "player1Wins": 2, "player2Wins": 1, "draws": 0 }
    }
  ]
}
```

---

#### `GET /api/matches/:matchId`

Get match details including individual game results.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Params   | `matchId` (string) |

**Response `200`:**

```json
{
  "id": "clxmatch007",
  "table": 1,
  "status": "confirmed",
  "roundId": "clxrnd002",
  "player1": { "id": "clxuser001", "displayName": "WizardPlayer42" },
  "player2": { "id": "clxuser002", "displayName": "GoblinFan99" },
  "reportedBy": "clxuser001",
  "confirmedBy": "clxuser002",
  "result": {
    "player1Wins": 2,
    "player2Wins": 1,
    "draws": 0,
    "winner": "clxuser001"
  },
  "games": [
    { "number": 1, "winner": "clxuser001", "onThePlay": "clxuser001" },
    { "number": 2, "winner": "clxuser002", "onThePlay": "clxuser002" },
    { "number": 3, "winner": "clxuser001", "onThePlay": "clxuser001" }
  ],
  "reportedAt": "2026-04-14T20:45:00Z",
  "confirmedAt": "2026-04-14T20:47:00Z"
}
```

---

#### `POST /api/matches/:matchId/report`

Report match results. Only the two players in the match may report.

| Property | Value |
|----------|-------|
| Auth     | Authenticated (must be player1 or player2) |
| Params   | `matchId` (string) |

**Request Body:**

```json
{
  "player1Wins": 2,
  "player2Wins": 1,
  "draws": 0,
  "games": [
    { "number": 1, "winner": "clxuser001", "onThePlay": "clxuser001" },
    { "number": 2, "winner": "clxuser002", "onThePlay": "clxuser002" },
    { "number": 3, "winner": "clxuser001", "onThePlay": "clxuser001" }
  ]
}
```

| Field         | Type   | Required | Notes                                           |
| ------------- | ------ | -------- | ----------------------------------------------- |
| `player1Wins` | int    | yes      | Games won by player 1                           |
| `player2Wins` | int    | yes      | Games won by player 2                           |
| `draws`       | int    | no       | Drawn games (default 0)                         |
| `games`       | array  | no       | Per-game details (winner, who was on the play)  |

**Response `200`:**

```json
{
  "success": true,
  "match": {
    "id": "clxmatch007",
    "status": "reported",
    "reportedBy": "clxuser001"
  }
}
```

**Errors:** `FORBIDDEN` (not a participant), `CONFLICT` (already reported/confirmed), `VALIDATION_ERROR` (win counts don't add up)

---

#### `POST /api/matches/:matchId/confirm`

Confirm the reported results. Must be called by the opponent of the player who reported.

| Property | Value |
|----------|-------|
| Auth     | Authenticated (must be opponent of reporter) |
| Params   | `matchId` (string) |

**Response `200`:**

```json
{
  "success": true,
  "match": {
    "id": "clxmatch007",
    "status": "confirmed",
    "confirmedBy": "clxuser002"
  }
}
```

**Errors:** `FORBIDDEN`, `CONFLICT` (not in `reported` status)

---

#### `POST /api/matches/:matchId/dispute`

Dispute the reported results. Must be called by the opponent of the reporter.

| Property | Value |
|----------|-------|
| Auth     | Authenticated (must be opponent of reporter) |
| Params   | `matchId` (string) |

**Request Body:**

```json
{
  "reason": "Score was 2-0, not 2-1"
}
```

**Response `200`:**

```json
{
  "success": true,
  "match": {
    "id": "clxmatch007",
    "status": "disputed"
  }
}
```

**Errors:** `FORBIDDEN`, `CONFLICT` (not in `reported` status)

---

#### `POST /api/matches/:matchId/resolve`

Admin-resolve a disputed match by setting the final result.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `matchId` (string) |

**Request Body:**

```json
{
  "player1Wins": 2,
  "player2Wins": 0,
  "draws": 0,
  "resolution": "Confirmed with player screenshots. Correct score is 2-0."
}
```

**Response `200`:**

```json
{
  "success": true,
  "match": {
    "id": "clxmatch007",
    "status": "confirmed",
    "resolvedBy": "clxadmin001",
    "resolution": "Confirmed with player screenshots. Correct score is 2-0."
  }
}
```

**Errors:** `FORBIDDEN`, `CONFLICT` (not in `disputed` status)

---

### Standings (`/api/seasons/:seasonId/standings`)

#### `GET /api/seasons/:seasonId/standings`

Get the current standings for a season, sorted by match points then tiebreakers.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Params   | `seasonId` (string) |
| Query Params | `asOf` (datetime, optional) — snapshot standings at a point in time |

**Response `200`:**

```json
{
  "seasonId": "clxseason01",
  "lastUpdated": "2026-04-14T22:00:00Z",
  "standings": [
    {
      "rank": 1,
      "player": { "id": "clxuser001", "displayName": "WizardPlayer42", "slug": "wizardplayer42" },
      "matchPoints": 9,
      "matchesPlayed": 6,
      "matchWins": 5,
      "matchLosses": 1,
      "matchDraws": 0,
      "gameWinPercentage": 0.7143,
      "opponentMatchWinPercentage": 0.5833,
      "opponentGameWinPercentage": 0.5200
    },
    {
      "rank": 2,
      "player": { "id": "clxuser002", "displayName": "GoblinFan99", "slug": "goblinfan99" },
      "matchPoints": 7,
      "matchesPlayed": 6,
      "matchWins": 4,
      "matchLosses": 1,
      "matchDraws": 1,
      "gameWinPercentage": 0.6250,
      "opponentMatchWinPercentage": 0.6111,
      "opponentGameWinPercentage": 0.5400
    }
  ]
}
```

---

### Card Pools (`/api/card-pools`)

#### `GET /api/seasons/:seasonId/card-pools`

List card pools for a season. Visibility depends on season `poolVisibility` (boolean). Site admins bypass it. Owners always see their own pools.

| Property | Value |
|----------|-------|
| Auth     | Optional. Same `poolVisibility` predicate as other pool list/get routes. |
| Params   | `seasonId` (string) |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clxpool001",
      "owner": { "id": "clxuser001", "displayName": "WizardPlayer42" },
      "cardCount": 96,
      "acquisitionCount": 7,
      "lastUpdated": "2026-04-14T18:00:00Z"
    }
  ]
}
```

---

#### `GET /api/card-pools/:poolId`

Get a card pool with all entries grouped by acquisition phase (initial sealed pool, per-event additions).

| Property | Value |
|----------|-------|
| Auth     | Depends on privacy settings |
| Params   | `poolId` (string) |

**Response `200`:**

```json
{
  "id": "clxpool001",
  "owner": { "id": "clxuser001", "displayName": "WizardPlayer42" },
  "seasonId": "clxseason01",
  "acquisitions": [
    {
      "id": "clxacq001",
      "phase": "initial",
      "status": "approved",
      "boosterProduct": { "id": "clxprod001", "name": "OTJ Play Booster" },
      "cards": [
        {
          "scryfallId": "12345-abcde",
          "name": "Oko, Thief of Crowns",
          "setCode": "OTJ",
          "collectorNumber": "197",
          "rarity": "mythic",
          "imageUri": "https://cards.scryfall.io/normal/front/1/2/12345.jpg",
          "isFoil": false
        }
      ],
      "addedAt": "2026-04-01T12:00:00Z",
      "approvedBy": "clxadmin001",
      "approvedAt": "2026-04-01T14:00:00Z"
    },
    {
      "id": "clxacq002",
      "phase": "event-addition",
      "status": "pending",
      "eventId": "clxevt002",
      "boosterProduct": { "id": "clxprod001", "name": "OTJ Play Booster" },
      "cards": [
        {
          "scryfallId": "67890-fghij",
          "name": "Lightning Bolt",
          "setCode": "OTJ",
          "collectorNumber": "145",
          "rarity": "uncommon",
          "imageUri": "https://cards.scryfall.io/normal/front/6/7/67890.jpg",
          "isFoil": false
        }
      ],
      "addedAt": "2026-04-14T17:30:00Z",
      "approvedBy": null,
      "approvedAt": null
    }
  ],
  "totalCards": 96
}
```

---

#### `POST /api/card-pools/:poolId/acquisitions`

Add a new acquisition batch (opened packs) to a card pool. Authenticated user must be the pool owner.

| Property | Value |
|----------|-------|
| Auth     | Authenticated (pool owner) |
| Params   | `poolId` (string) |

**Request Body:**

```json
{
  "boosterProductId": "clxprod001",
  "phase": "event-addition",
  "eventId": "clxevt002",
  "cards": [
    {
      "scryfallId": "67890-fghij",
      "name": "Lightning Bolt",
      "setCode": "OTJ",
      "collectorNumber": "145",
      "isFoil": false
    },
    {
      "scryfallId": "11111-aaaaa",
      "name": "Counterspell",
      "setCode": "OTJ",
      "collectorNumber": "58",
      "isFoil": true
    }
  ]
}
```

| Field              | Type     | Required | Notes                                         |
| ------------------ | -------- | -------- | --------------------------------------------- |
| `boosterProductId` | string   | yes      | Which booster product was opened               |
| `phase`            | string   | yes      | `initial` or `event-addition`                 |
| `eventId`          | string   | no       | Required if phase is `event-addition`          |
| `cards`            | array    | yes      | Array of card entries                          |
| `cards[].scryfallId` | string | yes      | Scryfall card ID                              |
| `cards[].name`     | string   | yes      | Card name (for display/search)                |
| `cards[].setCode`  | string   | yes      | Set code (e.g., "OTJ")                        |
| `cards[].collectorNumber` | string | yes | Collector number                              |
| `cards[].isFoil`   | boolean  | no       | Default `false`                               |

**Response `201`:**

```json
{
  "id": "clxacq003",
  "phase": "event-addition",
  "status": "pending",
  "cardCount": 2,
  "addedAt": "2026-04-14T18:00:00Z"
}
```

**Errors:** `FORBIDDEN` (not pool owner), `VALIDATION_ERROR` (invalid card data, wrong phase)

---

#### `PATCH /api/acquisitions/:acquisitionId/approve`

Approve a pending acquisition. Who can approve depends on league settings: admin-only or peer approval.

| Property | Value |
|----------|-------|
| Auth     | Admin (or peer, if `peerApprovalForAcquisitions` is enabled) |
| Params   | `acquisitionId` (string) |

**Response `200`:**

```json
{
  "success": true,
  "acquisition": {
    "id": "clxacq002",
    "status": "approved",
    "approvedBy": "clxadmin001",
    "approvedAt": "2026-04-14T19:00:00Z"
  }
}
```

**Errors:** `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` (not in `pending` status)

---

#### `PATCH /api/acquisitions/:acquisitionId/reject`

Reject a pending acquisition with a reason.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `acquisitionId` (string) |

**Request Body:**

```json
{
  "reason": "Card 'Black Lotus' is not in the OTJ set"
}
```

**Response `200`:**

```json
{
  "success": true,
  "acquisition": {
    "id": "clxacq002",
    "status": "rejected",
    "rejectedBy": "clxadmin001",
    "rejectionReason": "Card 'Black Lotus' is not in the OTJ set"
  }
}
```

**Errors:** `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` (not in `pending` status)

---

### Decklists (`/api/decklists`)

Season `decklistVisibility` (boolean, default `true`) gates public decklist access. Site admins bypass it. Owners always see their own decks.

**Who can see a deck**

- Owner or site admin: any status.
- Everyone else, when `decklistVisibility` is on:
  - `submitted` and `locked` (official registered lists), including the current round.
  - `draft` is never listed or openable.
- Everyone else, when `decklistVisibility` is off: nothing (`403` / omitted from lists).

`GET /api/decklists/:id` uses the same predicate as the list endpoints. A row returned by a list is openable. Other players’ `draft` decks return `403 FORBIDDEN`, including leftover extra decks after the round or event completes.

Unlisted deck shares are a separate `DecklistShare` snapshot, not a live ACL. Authenticated viewers who can see a list mint `POST /api/decklists/:id/share` (names included) and get a token. Recipients load `GET /api/share/decklists/:token`. That does not flip `decklistVisibility`, list the deck on `/decks`, or grant `GET /api/decklists/:id`. Older packed hash URLs (`/share/decks#v2.…`, `v1.`) still decode locally.

#### `POST /api/decklists/:decklistId/share`

Mint or reuse an unlisted snapshot token for a decklist the caller can view. Hidden current-round drafts stay owner/admin only.

| Property | Value |
|----------|-------|
| Auth     | Authenticated (same visibility as `GET /api/decklists/:id`) |
| Params   | `decklistId` (UUID) |

**Request Body:** `DeckSharePayload` (`v`, `ownerDisplayName`, `deckName`, `eventName`, `roundNumber`, `status`, `entries`). Body `entries` and `deckName` are used only when the caller is the deck owner; otherwise they are ignored. `ownerDisplayName`, `eventName`, `roundNumber`, and `status` are always stamped from the live row. Entry objects may include `setCode` / `collectorNumber`.

**Response `200`:** `{ "data": { "token": "…" } }` — same minter + same contents hash (includes `decklistId` and printings, no clock) reuses the token. Different decklists never alias. Remint after a hash-formula change may allocate a new token once; old tokens still GET.

**Errors:** `UNAUTHORIZED`, `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`

#### `GET /api/share/decklists/:token`

Public snapshot by token. Guests allowed. Does not call `getDecklistById`.

| Property | Value |
|----------|-------|
| Auth     | None |
| Params   | `token` (unguessable InviteLink-class string) |

**Response `200`:** `{ "data": { …DeckSharePayload } }`

**Errors:** `INVALID_SHARE` (`404`)

#### `GET /api/seasons/:seasonId/decklists`

List season decklists the viewer may see (registered `submitted`/`locked` lists only for non-owners).

| Property | Value |
|----------|-------|
| Auth     | Optional |
| Params   | `seasonId` (UUID) |

**Response `200`:** `{ "data": [ ...decklists with user, event, round, entries... ], "meta": { "decklistVisibility": true } }`

**Errors:** `NOT_FOUND`

#### `GET /api/decklists/my-season/:seasonId`

List the authenticated user’s own decks for a season, all statuses. Used by the deckbuilder import dialog. Not a public archive.

| Property | Value |
|----------|-------|
| Auth     | Authenticated |
| Params   | `seasonId` (UUID) |

**Errors:** `UNAUTHORIZED`, `NOT_FOUND`

#### `GET /api/events/:eventId/my-decklists` and `GET /api/events/:eventId/rounds/:roundId/my-decklists`

Authenticated owner builder payload for the **event**. Both paths return the same decks: required slots minted once per event (`orderIndex` `0..deckCount-1` when missing) plus extras already on that event. `roundId` / `roundNumber` in the payload are the selected Swiss round (pairings / extra-create metadata). Required tab ids stay the origin rows; they are not rewritten when Round 2 starts. The leftover round path does not mint a second required set. Returns that user’s decks of every status plus `matchesComplete`: `true` when the owner has at least one match in this event and every such match is `confirmed` or `resolved`. The client uses only this flag for extra-deck allocation UI. Not a public archive.

| Property | Value |
|----------|-------|
| Auth     | Authenticated |
| Params   | `eventId` (UUID); optional `roundId` (UUID) |

**Response `200`:** `{ "data": { "roundId", "roundNumber", "poolId", "decklists", "registeredCount", "eventConfig", "restrictedCards", "basicLands", "matchesComplete" } }`

**Errors:** `UNAUTHORIZED`, `NOT_FOUND`

#### `GET /api/events/:eventId/decklists`

List event decklists the viewer may see. Same visibility predicate as the season list (not an unfiltered dump).

| Property | Value |
|----------|-------|
| Auth     | Optional |
| Params   | `eventId` (UUID) |

**Response `200`:** `{ "data": [ ...filtered decklists... ] }`

**Errors:** `NOT_FOUND`

---

#### `GET /api/decklists/:decklistId`

Get a full decklist with all card entries.

| Property | Value |
|----------|-------|
| Auth     | Optional. Same visibility predicate as the season/event lists. |
| Params   | `decklistId` (string) |

**Response `200`:**

```json
{
  "id": "clxdeck001",
  "owner": { "id": "clxuser001", "displayName": "WizardPlayer42" },
  "eventId": "clxevt002",
  "roundNumber": 1,
  "status": "submitted",
  "mainboard": [
    {
      "scryfallId": "12345-abcde",
      "name": "Oko, Thief of Crowns",
      "setCode": "OTJ",
      "collectorNumber": "197",
      "quantity": 1,
      "imageUri": "https://cards.scryfall.io/normal/front/1/2/12345.jpg"
    },
    {
      "scryfallId": "22222-bbbbb",
      "name": "Forest",
      "setCode": "OTJ",
      "collectorNumber": "280",
      "quantity": 8,
      "imageUri": "https://cards.scryfall.io/normal/front/2/2/22222.jpg"
    }
  ],
  "sideboard": [
    {
      "scryfallId": "67890-fghij",
      "name": "Lightning Bolt",
      "setCode": "OTJ",
      "collectorNumber": "145",
      "quantity": 1,
      "imageUri": "https://cards.scryfall.io/normal/front/6/7/67890.jpg"
    }
  ],
  "mainboardCount": 40,
  "sideboardCount": 56,
  "createdAt": "2026-04-14T18:30:00Z",
  "updatedAt": "2026-04-14T19:00:00Z"
}
```

---

#### `POST /api/events/:eventId/decklists`

Create a new decklist for an event and round. Each player may have one decklist per round.

| Property | Value |
|----------|-------|
| Auth     | Authenticated |
| Params   | `eventId` (string) |

**Request Body:**

```json
{
  "roundNumber": 2,
  "mainboard": [
    { "scryfallId": "12345-abcde", "quantity": 1 },
    { "scryfallId": "22222-bbbbb", "quantity": 8 },
    { "scryfallId": "33333-ccccc", "quantity": 2 }
  ],
  "sideboard": [
    { "scryfallId": "67890-fghij", "quantity": 1 }
  ]
}
```

| Field                      | Type   | Required | Notes                              |
| -------------------------- | ------ | -------- | ---------------------------------- |
| `roundNumber`              | int    | yes      | Which round this decklist is for   |
| `mainboard`                | array  | yes      | Mainboard card entries             |
| `mainboard[].scryfallId`   | string | yes      | Scryfall card ID                   |
| `mainboard[].quantity`     | int    | yes      | Number of copies                   |
| `sideboard`                | array  | no       | Sideboard entries (remaining pool) |
| `sideboard[].scryfallId`   | string | yes      | Scryfall card ID                   |
| `sideboard[].quantity`     | int    | yes      | Number of copies                   |

**Response `201`:** Decklist object (same shape as `GET /api/decklists/:decklistId`).

**Errors:** `CONFLICT` (decklist already exists for this event and slot), `VALIDATION_ERROR`

---

#### `PATCH /api/decklists/:decklistId`

Update decklist entries. Only allowed while the decklist is in `draft` status.

| Property | Value |
|----------|-------|
| Auth     | Authenticated (decklist owner) |
| Params   | `decklistId` (string) |

**Request Body:**

```json
{
  "mainboard": [
    { "scryfallId": "12345-abcde", "quantity": 1 },
    { "scryfallId": "44444-ddddd", "quantity": 3 }
  ],
  "sideboard": [
    { "scryfallId": "67890-fghij", "quantity": 1 },
    { "scryfallId": "22222-bbbbb", "quantity": 8 }
  ]
}
```

**Response `200`:** Updated decklist object.

**Errors:** `FORBIDDEN`, `CONFLICT` (decklist already submitted)

---

#### `POST /api/decklists/:decklistId/submit`

Submit a decklist for the **event**. Runs validation against the card pool. Registration cap is `event.config.deckCount` submitted/locked lists for the event (`409 CONFLICT`: `Already registered N deck(s) for this event. Unregister one first.`).

| Property | Value |
|----------|-------|
| Auth     | Authenticated (decklist owner) |
| Params   | `decklistId` (string) |

**Response `200`:**

```json
{
  "success": true,
  "decklist": {
    "id": "clxdeck001",
    "status": "submitted"
  }
}
```

**Errors:** `FORBIDDEN`, `CONFLICT` (already registered N deck(s) for this event; already submitted), `VALIDATION_ERROR` (cards not in pool, minimum card count not met)

---

#### `POST /api/decklists/:decklistId/import`

Import from the previous round's submitted decklist as a starting point for the current round.

| Property | Value |
|----------|-------|
| Auth     | Authenticated (decklist owner) |
| Params   | `decklistId` (string) |

**Response `200`:** Decklist object populated with the previous round's entries.

**Errors:** `FORBIDDEN`, `NOT_FOUND` (no previous decklist), `CONFLICT` (decklist already has entries)

---

#### `GET /api/decklists/:decklistId/export/:format`

Export a decklist as a text format compatible with popular MTG platforms.

| Property | Value |
|----------|-------|
| Auth     | Optional. Same visibility predicate as `GET /api/decklists/:decklistId`. |
| Params   | `decklistId` (string), `format` (`mtgo` \| `arena` \| `moxfield`) |

**Response `200` (Content-Type: text/plain):**

```
// MTGO format example
1 Oko, Thief of Crowns
8 Forest
2 Island
3 Simic Signet
...

Sideboard
1 Lightning Bolt
1 Counterspell
...
```

**Errors:** `NOT_FOUND`, `FORBIDDEN` (privacy restriction)

---

#### `GET /api/decklists/:decklistId/validate`

Validate a decklist against the owner's card pool without submitting. Returns any violations.

| Property | Value |
|----------|-------|
| Auth     | Authenticated (decklist owner) |
| Params   | `decklistId` (string) |

**Response `200`:**

```json
{
  "valid": true,
  "warnings": [],
  "errors": []
}
```

**Response `200` (with violations):**

```json
{
  "valid": false,
  "warnings": [
    { "type": "LOW_CARD_COUNT", "message": "Mainboard has 38 cards (minimum 40)" }
  ],
  "errors": [
    { "type": "CARD_NOT_IN_POOL", "card": "Black Lotus", "message": "Card is not in your card pool" },
    { "type": "QUANTITY_EXCEEDED", "card": "Forest", "quantity": 10, "poolQuantity": 8, "message": "You only have 8 copies in your pool" }
  ]
}
```

---

### Users / Profiles (`/api/users`)

#### `GET /api/users/:slug`

Get a public user profile.

| Property | Value |
|----------|-------|
| Auth     | Public (optional auth adds `authProvider` for self) |
| Params   | `slug` (string) — user slug |

**Response `200`:**

```json
{
  "data": {
    "user": {
      "id": "clxuser001",
      "slug": "wizardplayer42",
      "displayName": "WizardPlayer42",
      "publicName": "Wizard",
      "discordHandle": "wizard_discord",
      "avatarUrl": "https://cdn.example.com/avatars/abc.png",
      "role": "user"
    },
    "league": { "slug": "friday-night-box-league", "name": "Friday Night Box League" },
    "activeSeason": {
      "id": "clxseason003",
      "number": 3,
      "name": "Season 3",
      "poolVisibility": true,
      "decklistVisibility": true,
      "scheduleVisibility": false
    },
    "currentStanding": {
      "rank": 4,
      "points": 9,
      "matchWins": 3,
      "matchLosses": 1,
      "matchDraws": 0,
      "omwPercent": 0.52,
      "gwPercent": 0.58,
      "ogwPercent": 0.49
    },
    "career": {
      "seasonsPlayed": 3,
      "totalMatches": 24,
      "matchWins": 14,
      "matchLosses": 8,
      "matchDraws": 2,
      "winRate": 0.583
    },
    "seasonHistory": [
      {
        "seasonId": "clxseason003",
        "number": 3,
        "name": "Season 3",
        "isActive": true,
        "rank": 4,
        "points": 9,
        "matchWins": 3,
        "matchLosses": 1,
        "matchDraws": 0
      }
    ],
    "links": {
      "poolId": "clxpool001",
      "poolVisible": true,
      "decklistsVisible": true
    }
  }
}
```

When the request is authenticated as the profile owner, `user.authProvider` is included.

**Errors:** `404 NOT_FOUND` when slug is unknown.

---

#### `GET /api/users/profile`

Get the authenticated user's editable profile (includes `authProvider`, `discordHandle`).

| Property | Value |
|----------|-------|
| Auth     | Authenticated |

---

#### `PATCH /api/users/profile`

Update own profile fields (`publicName`, `discordHandle` for Google sign-in users).

| Property | Value |
|----------|-------|
| Auth     | Authenticated |

**Response `200`:** Updated profile object under `data`.

**Errors:** `VALIDATION_ERROR`, `FORBIDDEN` (discord handle update for Discord sign-in users)

---

#### `GET /api/users/:slug/match-history`

Get a user's match history across all leagues.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Params   | `slug` (string) — user slug |
| Query Params | `seasonId` (string, optional), `page` (int, default 1), `limit` (int, default 20, max 50) |

**Response `200`:**

```json
{
  "data": [
    {
      "matchId": "clxmatch007",
      "league": { "slug": "friday-night-box-league", "name": "Friday Night Box League" },
      "season": { "number": 3, "name": "Season 3" },
      "event": { "name": "Week 2" },
      "round": 2,
      "opponent": { "slug": "goblinfan99", "displayName": "GoblinFan99" },
      "result": "win",
      "score": "2-1",
      "date": "2026-04-14T20:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

---

### Admin (`/api/admin`)

All routes require site admin authentication (`user.role === 'admin'`).

#### `GET /api/admin/deck-checks`

Returns registered lists and the active roster for the current **event** (table-side checks). Does not auto-create rounds. Official lists are `submitted` or `locked` with `orderIndex < deckCount` for the event (including origin-round rows while a later round is `in_progress`). Drafts and extra slots are omitted. `season.decklistVisibility` is ignored. Roster is league members minus season-wide or this-event drops. The payload `round` is still the selected Swiss round for labeling.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Query Params | `seasonId` (UUID, optional) — omitted or empty resolves the first `isActive` season (`number` desc). Unknown id is `NOT_FOUND`. Non-UUID is `VALIDATION_ERROR`. |

**Response `200`:**

```json
{
  "data": {
    "emptyReason": null,
    "season": { "id": "season-1", "name": "Season 1", "decklistVisibility": false },
    "event": { "id": "week-2", "name": "Week 2", "status": "active" },
    "round": { "id": "w2-r2", "roundNumber": 2, "status": "in_progress" },
    "deckCount": 2,
    "decklists": [],
    "players": [
      {
        "user": { "id": "user-alice", "displayName": "Alice", "publicName": null, "slug": "alice", "avatarUrl": null },
        "registeredCount": 1,
        "requiredCount": 2
      }
    ]
  }
}
```

`emptyReason` is `no_active_season`, `no_current_event`, `no_current_round`, or `null`. Known context layers stay filled on empty 200s. Zero registrations is `emptyReason: null` with `decklists: []` and a populated roster.

**Errors:** `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`

---

#### `GET /api/admin/card-cache/stats`

Returns cached card counts and last-updated timestamps for the requested set codes.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Query Params | `setCodes` (string, required) — comma-separated set codes, e.g. `DMU,MUL` |

**Response `200`:**

```json
{
  "data": [
    {
      "setCode": "DMU",
      "cachedCount": 412,
      "lastFetched": "2026-05-31T12:00:00.000Z"
    },
    {
      "setCode": "MUL",
      "cachedCount": 0,
      "lastFetched": null
    }
  ]
}
```

**Errors:** `FORBIDDEN`, `VALIDATION_ERROR`

---

#### `POST /api/admin/card-cache/import-set`

Re-imports all printings for a single set using paginated Scryfall search (`set:CODE`). Safe to run repeatedly (upserts by Scryfall ID).

| Property | Value |
|----------|-------|
| Auth     | Admin |

**Request Body:**

```json
{
  "setCode": "DMU"
}
```

**Response `200`:**

```json
{
  "data": {
    "results": [
      {
        "setCode": "DMU",
        "imported": 412,
        "cachedCount": 412,
        "lastFetched": "2026-05-31T12:00:00.000Z"
      }
    ],
    "totalImported": 412
  }
}
```

**Errors:** `FORBIDDEN`, `VALIDATION_ERROR`, `SCRYFALL_ERROR`

---

#### `POST /api/admin/card-cache/import-sets`

Imports multiple sets from Scryfall bulk data in one download. Prefer this for large multi-set imports.

| Property | Value |
|----------|-------|
| Auth     | Admin |

**Request Body:**

```json
{
  "setCodes": ["DMU", "STX"]
}
```

**Response `200`:** Same shape as `import-set` (`data.results`, `data.totalImported`).

**Errors:** `FORBIDDEN`, `VALIDATION_ERROR`, `SCRYFALL_ERROR`

---

#### `POST /api/admin/card-cache/import-booster-product/:id`

Loads the booster product’s configured set codes and imports each set via paginated Scryfall search (`set:CODE`). Does not download the full Scryfall bulk catalog.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `id` (string) — booster product ID |

**Response `200`:** Same shape as `import-set`.

**Errors:** `FORBIDDEN`, `NOT_FOUND`, `SCRYFALL_ERROR`

---

#### `POST /api/admin/matches/batch-report`

Batch-report results for multiple matches in a round. Useful when the admin is entering results for an in-person event.

| Property | Value |
|----------|-------|
| Auth     | Admin |

**Request Body:**

```json
{
  "roundId": "clxrnd002",
  "results": [
    {
      "matchId": "clxmatch007",
      "player1Wins": 2,
      "player2Wins": 1,
      "draws": 0
    },
    {
      "matchId": "clxmatch008",
      "player1Wins": 0,
      "player2Wins": 2,
      "draws": 0
    }
  ]
}
```

**Response `200`:**

```json
{
  "success": true,
  "reported": 2,
  "matches": [
    { "matchId": "clxmatch007", "status": "confirmed" },
    { "matchId": "clxmatch008", "status": "confirmed" }
  ]
}
```

**Errors:** `FORBIDDEN`, `VALIDATION_ERROR`

---

#### `GET /api/admin/disputes`

List all pending disputes across all leagues the admin manages.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Query Params | `leagueSlug` (string, optional) |

**Response `200`:**

```json
{
  "data": [
    {
      "matchId": "clxmatch010",
      "league": { "slug": "friday-night-box-league", "name": "Friday Night Box League" },
      "round": { "id": "clxrnd003", "number": 3 },
      "player1": { "id": "clxuser003", "displayName": "SnapcasterMage" },
      "player2": { "id": "clxuser004", "displayName": "BoltTheBird" },
      "reportedResult": { "player1Wins": 2, "player2Wins": 0, "draws": 0 },
      "disputeReason": "I actually won game 2",
      "disputedAt": "2026-04-21T20:30:00Z"
    }
  ]
}
```

---

#### `POST /api/admin/players/:userId/drop`

Drop a player from a season or event.

- For Swiss / seeded Swiss: remaining pending matches against the dropped player become byes for the opponent.
- For round-robin: remaining pending matches become confirmed auto-losses for the dropped player.
- Confirmed/resolved/reported/disputed results are preserved.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `userId` (string) |

**Request Body:**

```json
{
  "seasonId": "clxseason01",
  "eventId": "clxevt002",
  "reason": "Player requested to drop due to schedule conflict"
}
```

| Field      | Type   | Required | Notes                                         |
| ---------- | ------ | -------- | --------------------------------------------- |
| `seasonId` | string | yes      | Season to drop from                           |
| `eventId`  | string | no       | If provided, drop only from this event        |
| `reason`   | string | no       | Admin notes                                   |

**Response `200`:**

```json
{
  "success": true,
  "droppedFrom": "event",
  "affectedMatches": 2
}
```

**Errors:** `FORBIDDEN`, `NOT_FOUND`, `ALREADY_DROPPED`, `INVALID_OPERATION`, `VALIDATION_ERROR`

---

### Booster Products (`/api/booster-products`)

#### `GET /api/booster-products`

List all available booster products.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Query Params | `search` (string, optional), `setCodes` (comma-separated, optional) |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clxprod001",
      "name": "Outlaws of Thunder Junction Play Booster",
      "setCodes": ["OTJ"],
      "boosterType": "play",
      "cardsPerPack": 14,
      "releaseDate": "2024-04-19"
    },
    {
      "id": "clxprod002",
      "name": "The Big Score Collector Booster",
      "setCodes": ["BIG"],
      "boosterType": "collector",
      "cardsPerPack": 15,
      "releaseDate": "2024-04-19"
    }
  ]
}
```

---

#### `POST /api/booster-products`

Create a new booster product definition.

| Property | Value |
|----------|-------|
| Auth     | Admin |

**Request Body:**

```json
{
  "name": "Tarkir Dragonstorm Play Booster",
  "setCodes": ["TDM"],
  "boosterType": "play",
  "cardsPerPack": 14,
  "releaseDate": "2025-06-13"
}
```

**Response `201`:** Booster product object.

---

#### `GET /api/booster-products/:id`

Get booster product details.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Params   | `id` (string) |

**Response `200`:** Single booster product object (same shape as list items).

---

#### `PATCH /api/booster-products/:id`

Update a booster product.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `id` (string) |

**Response `200`:** Updated booster product object.

**Errors:** `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`

---

#### `DELETE /api/booster-products/:id`

Delete a booster product. Fails if the product is referenced by any season.

| Property | Value |
|----------|-------|
| Auth     | Admin |
| Params   | `id` (string) |

**Response `200`:**

```json
{ "success": true }
```

**Errors:** `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` (product in use by a season)

---

### Scryfall Proxy (`/api/cards`)

#### `GET /api/cards/search`

Search for cards by name. Results are cached in the `CachedCard` table to minimize Scryfall API calls.

| Property | Value |
|----------|-------|
| Auth     | Authenticated |
| Query Params | `q` (string, required) — search query, `sets` (string, optional) — comma-separated set codes |

**Example:** `GET /api/cards/search?q=lightning+bolt&sets=OTJ,OTP,BIG`

**Response `200`:**

```json
{
  "data": [
    {
      "scryfallId": "67890-fghij",
      "name": "Lightning Bolt",
      "setCode": "OTJ",
      "collectorNumber": "145",
      "rarity": "uncommon",
      "manaCost": "{R}",
      "typeLine": "Instant",
      "oracleText": "Lightning Bolt deals 3 damage to any target.",
      "imageUri": "https://cards.scryfall.io/normal/front/6/7/67890.jpg",
      "prices": { "usd": "0.25", "usdFoil": "0.75" },
      "cachedAt": "2026-04-30T00:00:00Z"
    }
  ],
  "totalResults": 1
}
```

---

#### `GET /api/cards/:scryfallId`

Get cached card data by Scryfall ID.

| Property | Value |
|----------|-------|
| Auth     | Public |
| Params   | `scryfallId` (string) |

**Response `200`:** Single card object (same shape as search results).

**Errors:** `NOT_FOUND` (card not yet cached — client should trigger a search first)

---

#### `POST /api/cards/bulk-lookup`

Bulk-lookup cards by name. Designed for pasting a list of card names from a pack opening. Uses Scryfall bulk data to avoid per-card API rate limits.

| Property | Value |
|----------|-------|
| Auth     | Authenticated |

**Request Body:**

```json
{
  "cards": [
    { "name": "Lightning Bolt", "setCode": "OTJ" },
    { "name": "Counterspell", "setCode": "OTJ" },
    { "name": "Forest" }
  ]
}
```

**Response `200`:**

```json
{
  "found": [
    {
      "scryfallId": "67890-fghij",
      "name": "Lightning Bolt",
      "setCode": "OTJ",
      "collectorNumber": "145",
      "rarity": "uncommon",
      "imageUri": "https://cards.scryfall.io/normal/front/6/7/67890.jpg"
    },
    {
      "scryfallId": "55555-eeeee",
      "name": "Counterspell",
      "setCode": "OTJ",
      "collectorNumber": "58",
      "rarity": "uncommon",
      "imageUri": "https://cards.scryfall.io/normal/front/5/5/55555.jpg"
    }
  ],
  "notFound": [
    { "name": "Forest", "reason": "Multiple printings found — specify a set code" }
  ],
  "ambiguous": [
    { "name": "Forest", "options": ["OTJ", "MKM", "LCI"] }
  ]
}
```

---

#### `POST /api/cards/bulk-import`

Imports all cards for the given set codes from Scryfall bulk data into the local cache. Admin-only; prefer `/api/admin/card-cache/*` for UI-driven imports.

| Property | Value |
|----------|-------|
| Auth     | Admin |

**Request Body:**

```json
{
  "setCodes": ["DMU", "STX"]
}
```

**Response `200`:**

```json
{
  "data": {
    "results": [
      { "setCode": "DMU", "imported": 412 },
      { "setCode": "STX", "imported": 287 }
    ],
    "totalImported": 699
  }
}
```

**Errors:** `FORBIDDEN`, `VALIDATION_ERROR`, `SCRYFALL_ERROR`

---

## Rate Limiting

| Scope                     | Limit                | Notes                                                   |
| ------------------------- | -------------------- | ------------------------------------------------------- |
| Global per-user           | 100 requests/minute  | All authenticated endpoints                             |
| Card search (`/api/cards/search`) | 10 requests/minute | Per-user; results cached server-side                   |
| Bulk lookup (`/api/cards/bulk-lookup`) | 5 requests/minute | Per-user; larger payloads accepted                   |
| Public endpoints          | 200 requests/minute  | Per IP                                                  |

### Caching Strategy

- Card data (oracle text, image URIs) is refreshed **weekly** from Scryfall bulk data.
- Card prices are refreshed **daily**.
- Bulk imports use Scryfall's [bulk data endpoint](https://scryfall.com/docs/api/bulk-data) to avoid per-card API calls.
- Client-side search autocomplete should debounce input by **300ms** before triggering API calls.

Rate-limited responses return:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Try again in 30 seconds.",
    "retryAfter": 30
  }
}
```

The `Retry-After` header is also set on the HTTP response.
