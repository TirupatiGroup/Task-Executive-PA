# Troubleshooting

## Local setup

**`Startup aborted: invalid environment configuration`**
The server fails fast on missing variables. Check `server/.env` against `server/.env.example`. In production you additionally need `JWT_SECRET` (32+ chars), `MICROSOFT_CLIENT_ID`, `MICROSOFT_TENANT_ID`.

**`could not connect to MongoDB`**
`DATABASE_URL` is wrong or the database is down. Test the string with `mongosh "$DATABASE_URL" --eval "db.adminCommand('ping')"`. On Atlas the URL must include the database name and correct `authSource` (usually `admin`).

**`prisma db push` errors**
Ensure the database is reachable and the user has read/write on the target database. Schema changes ship via `db push` (no migration files on Mongo); keep `render.yaml`/deploy steps free of `prisma migrate` commands.

## Authentication

**Redirect URI / AADSTS error on sign-in**
The Entra app registration redirect URI must exactly match the origin, including scheme and `/auth` path (`http://localhost:5173/auth`, `https://<site>/auth`). Update `VITE_MSAL_REDIRECT_URI` to match.

**"This account is not authorized to access Executive PA"**
Working as intended — only `ALLOWED_USER_EMAIL` may sign in.

**"Session expired"**
Session JWTs last 12 hours. Sign in again.

**Calendar tab empty**
Calendar shows only calendars explicitly shared with the signed-in account. Check the connection status on the page; Graph sync errors are recorded per connection and shown as degraded state, not crashes.

## Deployment

**Render service sleeps and reminders are late**
Free web services sleep when idle. Ping `GET /api/health` every 5 minutes with a free external cron (cron-job.org or similar) to keep the scheduler ticking within free limits.

**`/api/ready` returns 503**
The API process is up but the database is unreachable — check `DATABASE_URL` and provider status. Liveness (`/api/health`) can be 200 while readiness is 503; that distinction is the point.

**CORS errors in the browser**
`CLIENT_URL` (and `ADDITIONAL_ORIGINS`, comma-separated) on the API must include your frontend origin exactly, scheme included.

**Client shows old version after deploy**
The service worker caches the app shell. Deployed builds bump `CACHE_VERSION` in `client/public/sw.js`; the in-app banner offers "Refresh". Hard-refresh (Ctrl+Shift+R) always bypasses it.

## Reminders

**Duplicate reminders after restart**
Should not happen: notifications are deduped by `(userId, dedupeKey)` uniqueness. If you see duplicates, check for two API instances sharing one database — run a single instance (single-user app).

**Reminders never fire locally**
The scheduler starts with the server (`NODE_ENV !== 'test'`) and ticks every 5 minutes. Confirm the server log shows "Reminder scheduler started".

## PWA

**No install prompt**
Installability requires HTTPS, a manifest with 192/512 icons, and a service worker. All ship in production builds; localhost counts as secure for testing. Icons can be regenerated with `npm run icons`.

**Offline behavior**
The shell loads offline; API data requires connectivity by design (no insecure caching of private data).
