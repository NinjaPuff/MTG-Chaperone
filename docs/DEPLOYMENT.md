# Home Server Deployment (Cloudflare Tunnel)

Deploy **MTG Chaperone** on a home server with Docker Compose and [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/). No router port forwarding required.

## Architecture

```
Browser → Cloudflare (TLS) → cloudflared tunnel → App (Express) → Postgres
```

The app container serves both the React UI and `/api` routes on port 3000. Cloudflare terminates HTTPS at the edge; `cloudflared` forwards plain HTTP to `http://app:3000` on the internal Docker network.

## Prerequisites

- A machine on your home network with Docker and Docker Compose v2
- A domain (registrar can stay at Porkbun)
- A free [Cloudflare](https://dash.cloudflare.com/) account
- Discord and/or Google OAuth application credentials

## 1. Cloudflare DNS

1. Add your domain in Cloudflare (import or copy DNS records from Porkbun).
2. At Porkbun, change the domain **nameservers** to the pair Cloudflare provides.
3. Wait until Cloudflare shows the domain as **Active** (usually minutes, sometimes up to 24 hours).

Keeping Porkbun as registrar is fine — only DNS hosting moves to Cloudflare.

## 2. Cloudflare Tunnel (one-time)

1. Cloudflare dashboard → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel**.
2. Choose **Docker** as the connector type and copy the tunnel token.
3. Add a **Public Hostname** for your domain:
   - Subdomain: `@` (apex) and/or `www`
   - Service type: **HTTP**
   - URL: `http://app:3000` — use the Docker service name `app`, **not** `localhost`
4. Save the tunnel.

Cloudflare creates the DNS records for the public hostname automatically when DNS is on Cloudflare.

## 3. OAuth provider setup

Update redirect URIs in both Discord and Google developer consoles:

- `https://yourdomain.com/api/auth/discord/callback`
- `https://yourdomain.com/api/auth/google/callback`

These must match `DISCORD_CALLBACK_URL` and `GOOGLE_CALLBACK_URL` in your `.env.production` exactly.

## 4. Configure environment

On the home server:

```bash
git clone https://github.com/your-org/MtgBoxLeagueHelper.git
cd MtgBoxLeagueHelper
cp .env.production.example .env.production
```

Edit `.env.production` (this file is gitignored):

- Set `DOMAIN` to your domain (e.g. `league.example.com`)
- Set `CLOUDFLARE_TUNNEL_TOKEN` from the Cloudflare tunnel setup
- Set `CLIENT_URL`, `DISCORD_CALLBACK_URL`, and `GOOGLE_CALLBACK_URL` to `https://<DOMAIN>`
- Set strong values for `POSTGRES_PASSWORD` and `JWT_SECRET`
- Add OAuth client IDs and secrets
- Ensure `DATABASE_URL` uses host `postgres` (the Docker service name)
- Optional: `VITE_KOFI_URL=https://ko-fi.com/yourpage` for the footer support link (requires image rebuild)

## 5. Build and start

Pass your env file on every compose command so build args and runtime config stay in sync:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

`VITE_KOFI_URL` from that file is passed into the image build and inlined by Vite. Changing it later requires `build` again, not just `up`.

The app entrypoint runs `prisma migrate deploy` automatically on startup.

To run migrations manually instead:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm --entrypoint "" app npm run db:migrate:deploy --workspace=server
```

## 6. Verify

- `https://yourdomain.com` — loads the UI ("Sign in to MTG Chaperone")
- `https://yourdomain.com/api/health` — returns `{ "status": "ok" }`
- Discord/Google login completes and redirects to `/auth/callback` (if OAuth configured)

Check container logs if something fails:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f cloudflared
```

Confirm the tunnel is connected (no repeated `Invalid tunnel token` errors in `cloudflared` logs).

## Docker naming

| Artifact | Name |
|----------|------|
| Compose project | `mtg-chaperone` |
| App image | `mtg-chaperone:latest` |
| App container | `mtg-chaperone-app` |
| DB container | `mtg-chaperone-db` |
| Tunnel container | `mtg-chaperone-tunnel` |

## Postgres volume and upgrades

The compose file uses a named volume `mtg-chaperone_pgdata` so data persists across container recreates.

If you previously deployed with the old project name (`mtgboxleaguehelper`), Postgres data may live in a different volume (e.g. `mtgboxleaguehelper_pgdata`). Back up before switching:

```bash
docker run --rm -v mtgboxleaguehelper_pgdata:/data -v $(pwd):/backup alpine tar czf /backup/pg-backup.tar.gz -C /data .
```

Or attach the old volume name temporarily in `docker-compose.prod.yml` under `volumes.pgdata.name`.

## Migration from Caddy / port forwarding

If the old stack is running:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down
docker rm -f mtgleague-caddy 2>/dev/null || true
docker volume rm mtgboxleaguehelper_caddy_data mtgboxleaguehelper_caddy_config 2>/dev/null || true
git pull
# Merge existing .env.production secrets and add CLOUDFLARE_TUNNEL_TOKEN
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

After the tunnel is verified, you can remove router port forwards for 80/443 (optional hardening).

## Security notes

- Postgres is **not** exposed to the internet — only reachable on the internal Docker network.
- No host ports 80/443 are bound; inbound traffic arrives via the outbound tunnel only.
- Never commit `.env.production` to git. Only `.env.production.example` (placeholders) is tracked.
- Keep the host OS and Docker images updated.
- Use strong, unique secrets for `JWT_SECRET` and `POSTGRES_PASSWORD`.

## Optional follow-ups

- **Cloudflare Access:** add an auth gate in front of the site for a private league.
- **Automated deploys:** GitHub Actions builds and pushes `mtg-chaperone:latest`; home server pulls on a schedule or webhook.
- **Backups:** periodic `pg_dump` of the `mtg-chaperone_pgdata` volume.
