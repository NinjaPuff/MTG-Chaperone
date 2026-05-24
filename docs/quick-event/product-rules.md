# Quick Event — Product Rules

Keep these in mind in **every** chunk.

## Access

1. **Share link required** to view (`/quick/:shareToken`). Not listed on main schedule/dashboard.
2. **Public GET** — no login to view pairings/standings.
3. **Host must be authenticated** — `Event.organizerId` set at create.
4. **One open event per host** — `setup` or `active` blocks another create (`409 HOST_EVENT_OPEN`). Complete event to start another.
5. **Walk-ins** — added by host or site admin only; `User.isGuest = true`; can view via link; **never report**.
6. **Join roster** — logged-in users, only while event `setup`.
7. **Site admin** — list all active ad-hoc events on Admin page (exception to link-only discovery).

## Actor matrix

| Actor | Share link | Logged in | Can view | Add walk-ins | Can report |
|-------|------------|-----------|----------|--------------|------------|
| Public spectator | Required | No | Yes | No | No |
| Logged-in spectator | Required | Yes | Yes | No | No |
| Walk-in player | Required | No | Yes | No | No |
| Registered player | Required | Yes | Yes | No | Own matches (see below) |
| Event host | Required | Required | Yes | Yes | All matches + round controls |
| Site admin | Required or admin list | Yes | Yes | Yes | All matches |

## Match reporting

| Match type | Who can report | Confirm |
|------------|----------------|---------|
| Reg vs reg (participants) | Either participant | Non-reporter confirms (two-step) |
| Reg vs reg (host/admin) | Host or site admin | Auto-confirm |
| Reg vs walk-in | Registered opponent, host, or site admin | Auto-confirm |
| Walk-in vs walk-in | Host or site admin only | Auto-confirm |
| Spectator | No one | — |

## Out of scope

- Auto-advance to next Swiss round
- Guest OAuth / magic-link login
- E2E Playwright tests
- Full Swiss pairing improvements (score groups, rematch avoidance)
- Multiple concurrent quick events per host
