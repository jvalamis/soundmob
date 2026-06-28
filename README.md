# soundmob

Synced listening rooms — operator hosts the YouTube queue; listeners join with a room code (no password).

**Repo:** https://github.com/jvalamis/soundmob

## Live

**https://soundmob.jvalamis.workers.dev**

## Stack

- [Hono](https://hono.dev) on Cloudflare Workers
- **Durable Objects** — per-room WebSocket sync (playback state + chat)
- **KV** — host sessions + public `live:room` pointer
- Workers Assets for static files
- Secrets via ged vault → Cloudflare Secrets Store

## Flow

1. **Operator** — sign in with Google (allowlisted email) → `/host` → auto-create or resume room
2. **Landing** — shows live room code + now playing when operator session is active
3. **Listeners** — `/listen?code=…` or **join live** from landing → synced playback
4. Operator searches YouTube and drives the queue

Only the operator (`SOUNDMOB_OPERATOR_EMAIL` in vault) can host. Listeners need the room code only.

## Develop

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run typecheck
npm run deploy
```

Requires `CLOUDFLARE_API_TOKEN` or `wrangler login`.

Push `SOUNDMOB_OPERATOR_EMAIL` to vault **before** deploy so host routes are enabled.

## Secrets (ged vault)

| Secret | Purpose |
|--------|---------|
| `YOUTUBE_DATA_API_KEY` | Server-side YouTube search |
| `SOUNDMOB_OAUTH_CLIENT_ID` | Host sign-in (Google OAuth Web client) |
| `SOUNDMOB_OAUTH_CLIENT_SECRET` | OAuth client secret (`GOCSPX-*`) |
| `SESSION_SECRET` | Room init + session signing |
| `SOUNDMOB_OPERATOR_EMAIL` | Google account email allowed to host |

Push from ged meta repo (never commit values):

```bash
cd ../ged && npm run ged:vault -- --push --from-env /path/to/soundmob-secrets.env
```

### Google OAuth setup

1. [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients?project=janvincentalamis) — open your **Web application** client.
2. Enable **YouTube Data API v3** on project `janvincentalamis` if not already enabled.
3. On the client, set:
   - **Authorized JavaScript origins:** `https://soundmob.jvalamis.workers.dev`
   - **Authorized redirect URIs:** `https://soundmob.jvalamis.workers.dev/auth/google/callback`  
     (add `http://localhost:8787/auth/google/callback` for `wrangler dev`)
4. [OAuth consent screen](https://console.cloud.google.com/auth/overview?project=janvincentalamis) — if app is in **Testing**, add test users as needed.
5. Push `SOUNDMOB_OAUTH_*` + `SOUNDMOB_OPERATOR_EMAIL` to vault.

No worker redeploy needed for secret updates — Secrets Store bindings resolve at runtime.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| `room_create_failed (room_init_forbidden)` | `SESSION_SECRET` mismatch | Ensure vault has `SESSION_SECRET`; DO uses `readSecret()` |
| `operator_not_configured` | Missing `SOUNDMOB_OPERATOR_EMAIL` | Push operator Google email to vault |
| `not_operator` on host | Signed-in user ≠ vault email | Sign in with operator account |
| `search_failed` | Missing/invalid `YOUTUBE_DATA_API_KEY` | `npm run ged:vault -- --inventory` in ged |
| Google `deleted_client` | Stale OAuth client in vault | Push current `SOUNDMOB_OAUTH_*` via `ged:vault` |

OAuth verification: see [docs/oauth-verification-runbook.md](docs/oauth-verification-runbook.md).

## API

| Route | Description |
|-------|-------------|
| `GET /` | Landing (SSR live card) |
| `GET /api/live` | Public live status `{ live, code?, playback?, … }` |
| `GET /host` | Host dashboard (operator only) |
| `GET /listen` | Listener join |
| `GET /auth/google` | Start Google OAuth |
| `POST /api/rooms` | Create room (operator only) |
| `GET /api/rooms/active` | Resume operator room |
| `GET /api/youtube/search?q=` | Search videos (operator only) |
| `GET /room/:code/ws` | WebSocket sync (role=host\|listener) |
| `GET /health` | Liveness |

## Branch policy

`master` requires a PR for everyone except **jvalamis** (ruleset bypass — you can push directly).

## History

Legacy Angular 6 + Express + Socket.io app removed in 2026 rebuild. See git history before `070ae23`.
