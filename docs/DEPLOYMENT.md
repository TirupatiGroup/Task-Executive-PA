# Deployment Guide (zero-cost)

Provider-agnostic by design. The configs in this repo target currently suitable free tiers; if a provider's free tier changes, redeploy the same app elsewhere with the same environment variables.

**Verify free-tier limits at deploy time.** If a provider is no longer free, choose another rather than adding cost.

## 1. Database — MongoDB Atlas (free tier)

1. Create an Atlas project (M0 free cluster) or any free Mongo hosting.
2. Copy the connection string (`mongodb+srv://user:pass@cluster.mongodb.net/executive_pa`) and create the `executive_pa` database.
3. This becomes `DATABASE_URL` for both the API and your local backup scripts.
4. Push the schema once: `npx prisma db push` (no migration files on Mongo; the API starts without migrate steps).

## 2. API — Render (free web service)

The repo includes `render.yaml` (Blueprint). Manual setup equivalent:

- **Root directory:** `server`
- **Build command:** `npm ci && npx prisma generate`
- **Start command:** `node src/index.js`
- **Health check path:** `/api/ready`

Environment variables:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Atlas connection string (`mongodb+srv://...`) |
| `JWT_SECRET` | 32+ random chars (Render can generate) |
| `MICROSOFT_CLIENT_ID` | Entra app registration client id |
| `MICROSOFT_TENANT_ID` | Entra tenant id |
| `ALLOWED_USER_EMAIL` | the single approved account email |
| `CLIENT_URL` | `https://<your-site>.netlify.app` |
| `SERVER_URL` | `https://<your-api>.onrender.com` |

Free-tier notes: the service sleeps after ~15 min idle and wakes on request; the in-process reminder scheduler ticks only while awake. For personal use this is acceptable — open the app (or any health check) to wake it. If reminders must fire while you are not using the app, add a free external cron pinging `GET /api/health` every 5 minutes (e.g. cron-job.org), which keeps the worker awake within free limits.

## 3. Frontend — Netlify (free static)

The repo includes `netlify.toml`. Manual setup equivalent:

- **Base directory:** `client`
- **Build command:** `npm ci && npm run build`
- **Publish directory:** `dist`

Environment variables (Vite build-time, browser-safe only):

| Variable | Value |
|---|---|
| `VITE_MSAL_CLIENT_ID` | same Entra client id |
| `VITE_MSAL_AUTHORITY` | `https://login.microsoftonline.com/<tenant-id>` |
| `VITE_MSAL_REDIRECT_URI` | `https://<your-site>.netlify.app/auth` |
| `VITE_MSAL_SCOPES` | `openid profile email User.Read Calendars.Read` |
| `VITE_API_BASE_URL` | `https://<your-api>.onrender.com` |

Never put server secrets in `VITE_*` variables — they are embedded in the public bundle.

## 4. Microsoft Entra redirect URIs (must match exactly)

In the Entra app registration → *Authentication*:

- SPA redirect URIs:
  - `http://localhost:5173/auth` (dev)
  - `https://<your-site>.netlify.app/auth` (production)
- Logout URL: `https://<your-site>.netlify.app`
- Implicit grant flags stay **off** (the app uses Authorization Code + PKCE).

The backend validates the ID token against the tenant issuer and the client audience, so these must match the deployed origins exactly.

## 5. Post-deploy smoke test checklist

1. `GET https://<api>/api/health` → 200 `{"data":{"status":"ok"}}`.
2. `GET https://<api>/api/ready` → 200 `{"data":{"ready":true}}` (503 if database unreachable).
3. Open the site on phone and desktop → sign in with the allowed Microsoft account.
4. Sign in with a **different** Microsoft account → must be denied ("This account is not authorized").
5. Calendar tab loads shared calendar events (no email permissions requested).
6. Create a task with a near due date → reminder notification appears; restart the API → no duplicate reminders.
7. Assistant: voice query works where supported; typed query works everywhere.
8. Install the PWA (browser install prompt) and confirm standalone launch on mobile.

## 6. Updating the app

- Backend: push to the connected branch; Render redeploys (schema changes ship via `npx prisma db push` from your machine, not on deploy).
- Frontend: push to the connected branch; Netlify rebuilds. Bump `CACHE_VERSION` in `client/public/sw.js` when changing cached shell assets so clients pick up the update.
