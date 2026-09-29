# Executive PA

Private, single-user responsive PWA for executive task, follow-up and calendar command centre.

- **Frontend:** React 18 + Vite PWA, Tailwind CSS, MSAL (Microsoft Entra ID)
- **Backend:** Node.js + Express (layered: Route → Middleware → Validator → Controller → Service → Repository → Prisma)
- **Database:** MongoDB + Prisma
- **Voice:** browser Web Speech API with typed fallback (no paid AI service)

Single approved user (email allowlist). Calendar access is read-only for explicitly shared Outlook calendars. No email or WhatsApp access, by design.

## Quick start (local development)

Prerequisites: Node.js ≥ 20, MongoDB ≥ 6 (local Docker or Atlas), MongoDB Database Tools (`mongodump`/`mongorestore`) for backup scripts.

```bash
# 1. Install dependencies (root + server + client)
npm run setup

# 2. Configure environment
cp server/.env.example server/.env        # fill DATABASE_URL, MICROSOFT_*, ALLOWED_USER_EMAIL, JWT_SECRET
cp client/.env.example client/.env        # fill VITE_MSAL_* values

# 3. Push schema and (optionally) seed
cd server
npx prisma db push
npm run db:seed

# 4. Run
npm run dev           # API on http://localhost:4000 + SPA on http://localhost:5173, concurrently
npm run dev:server    # API only
npm run dev:client    # SPA only (proxies /api to :4000)
```

### Microsoft Entra ID setup (one-time)

1. In Entra admin center, register a **Single-page application**.
2. Note the **Application (client) ID** and your **Directory (tenant) ID**.
3. Add redirect URI: `http://localhost:5173/auth` (and your production URL later — it must match exactly, HTTPS in production).
4. Delegated Microsoft Graph permissions: `openid`, `profile`, `email`, `User.Read`, `Calendars.Read` (read-only; admin-consent not required for these).

## Production deployment (zero-cost)

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the full walkthrough. Summary:

| Layer    | Provider (replaceable)     | Notes                                              |
|----------|----------------------------|----------------------------------------------------|
| Database | MongoDB Atlas free tier    | `DATABASE_URL` (mongodb+srv)                        |
| API      | Render free web service    | `render.yaml` blueprint included                    |
| Frontend | Netlify free static        | `netlify.toml` included; SPA fallback + SW headers |

Health checks: `GET /api/health` (liveness) and `GET /api/ready` (readiness incl. database).

## Backup & restore

```bash
npm run db:backup                     # writes server/backups/epa-<timestamp>.sql
npm run db:restore -- dump.sql --url "$TARGET_DATABASE_URL"
```

Backups contain all private data: store them encrypted and privately. The documented restore test procedure is in **[docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md)**.

## Tests & verification

```bash
npm test            # server regression suite (node --test)
npm run lint        # syntax checks
npm run build:client  # production PWA build
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — layered architecture, module map, request flow
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — zero-cost deployment, env vars, Entra redirect URIs, smoke tests
- [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) — backup schedule, restore test, retention
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — common failures and fixes
- [CHANGELOG.md](CHANGELOG.md) — phase-by-phase history

## Security model

- SPA signs in with MSAL (Authorization Code + PKCE); backend verifies the ID token against tenant keys, applies the single-user email allowlist and mints its own 12-hour session JWT. The Microsoft token never becomes a session credential.
- All protected routes require a verified session; owner identity always derives from the verified token, never from the browser.
- Zod whitelists every body/params/query input including enum and sort values.
- Helmet, locked CORS (only configured origins), rate limiting, 256 kB body cap.
- Safe error responses: no stack traces or database internals in production.
- Logger redacts secret-like keys; no secrets in source control; client bundle contains only browser-safe values.

## License

UNLICENSED — private personal project.
