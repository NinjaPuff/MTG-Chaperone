# MTG Box League Helper

A web application for organizing and managing MTG box league play. Track card pools, build decklists, report matches, and view standings -- all in one place.

## Architecture

```
MtgBoxLeagueHelper/
├── client/          React 18 + TypeScript + Vite frontend
├── server/          Express + TypeScript + Prisma backend
├── shared/          Shared TypeScript types and enums
├── docs/            Feature specs, data model, and API docs
└── docker-compose.yml   Local PostgreSQL
```

### Tech Stack

| Layer          | Technology                                     |
|----------------|------------------------------------------------|
| Frontend       | React 18, TypeScript, Vite, Tailwind CSS, Shadcn/ui |
| Backend        | Node.js, Express, TypeScript                   |
| Database       | PostgreSQL via Prisma ORM                      |
| Authentication | OAuth 2.0 (Discord, Google) via Passport.js    |
| Card Data      | Scryfall API (cached locally)                  |
| Notifications  | Discord Webhooks                               |

### Design

- Dark theme by default (Scryfall/Moxfield inspired), with light mode toggle
- Mobile-first responsive layout
- Clean, human-readable URLs

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Docker](https://www.docker.com/) (for PostgreSQL)
- Discord and/or Google OAuth application credentials

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-org/MtgBoxLeagueHelper.git
cd MtgBoxLeagueHelper
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your database URL and OAuth credentials. See `.env.example` for all required variables.

### 3. Start the database

```bash
docker-compose up -d
```

### 4. Run database migrations

```bash
npm run db:migrate
```

### 5. Start development servers

```bash
npm run dev
```

This starts both the client (http://localhost:5173) and server (http://localhost:3000) concurrently.

### Individual commands

```bash
npm run dev:client    # Vite dev server with HMR
npm run dev:server    # Express with hot reload (tsx)
npm run db:studio     # Prisma Studio for database inspection
npm run db:generate   # Regenerate Prisma client after schema changes
npm run build         # Production build (shared → client → server)
```

## Domain Glossary

| Term                | Definition |
|---------------------|------------|
| **Box League**      | A sealed-pool format where each player opens packs from a specific MTG set and builds decks exclusively from their card pool |
| **Season**          | A fully independent league season; nothing carries over except user accounts and career stats |
| **Event**           | A tournament within a season (Swiss, Seeded Swiss, or Round Robin); one active at a time |
| **Round**           | A round within an event containing match pairings |
| **Card Pool**       | A player's collection of opened cards for a season, growing with each acquisition phase |
| **Acquisition Phase** | A batch of cards added to a pool at a specific point (initial pool, after event 1, etc.) |
| **Booster Product** | A specific booster type for an MTG set (e.g., "OTJ Play Booster") that maps to one or more Scryfall set codes |
| **Decklist**        | A deck built from a player's pool, scoped to a specific event and round |
| **Standing**        | A player's computed ranking: points, OMW%, GW%, OGW% |
| **OMW%**            | Opponent Match Win Percentage -- average win rate of all opponents faced |
| **GW%**             | Game Win Percentage -- personal game win rate across all games |
| **OGW%**            | Opponent Game Win Percentage -- average game win rate of all opponents |
| **Bye**             | A free win given to a player when there's an odd number of participants |
| **Seeded Swiss**    | Swiss pairings where round 1 is seeded by a configurable prior ranking |

## Documentation

- [Feature Specifications](docs/FEATURES.md) -- Detailed specs for all 20 planned features
- [Data Model](docs/DATA_MODEL.md) -- Entity relationships, field definitions, lifecycle state machines
- [API Reference](docs/API.md) -- RESTful endpoint catalog with request/response shapes

## Project Status

This project is in the **foundation phase**. The scaffolding, database schema, UI shell, and feature documentation are in place. Feature implementation is the next phase.

See `docs/FEATURES.md` for the full feature roadmap with priorities:
- **P0** (launch blockers): Auth, League/Season/Event management, Match reporting, Standings, Tiebreakers
- **P1** (important): Tournament pairing, Card pool tracking, Deck builder, Scryfall integration, Dashboard, Profiles
- **P2** (nice to have): Discord notifications, In-app notifications, Data export, Career stats, Admin dashboard, Card trading
