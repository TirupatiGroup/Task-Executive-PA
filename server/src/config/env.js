// Centralized environment configuration + startup validation.

const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Auto-detect Railway/PAAS: their injected reference vars exist before ours.
const IS_PaaS = Boolean(process.env.RAILWAY_PROJECT_ID || process.env.RENDER || process.env.FLY_APP_NAME);

let jwtSecret = process.env.JWT_SECRET || '';
if (!jwtSecret) {
  // Single-user app: an ephemeral per-boot secret is acceptable. Sessions are
  // invalidated on redeploy (users sign in again), but nothing is persisted.
  jwtSecret = crypto.randomBytes(32).toString('hex');
  if (IS_PaaS || process.env.NODE_ENV === 'production') {
    console.warn('[config] JWT_SECRET not set - generated a random per-boot secret. Users will be signed out after each redeploy.');
  }
}

const config = {
  NODE_ENV: process.env.NODE_ENV || (IS_PaaS ? 'production' : 'development'),
  PORT: parseInt(process.env.PORT || '4000', 10),
  // MONGO_URL fallback: Railway's MongoDB template exposes MONGO_URL, so a
  // single reference variable (DATABASE_URL=${{Mongo.MONGO_URL}}) suffices.
  DATABASE_URL: process.env.DATABASE_URL || process.env.MONGO_URL || '',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:4000',

  // Single approved account (email + password auth).
  // Default = the deployer's own login email so no variable is needed in
  // production; override with ALLOWED_USER_EMAIL for a different user.
  ALLOWED_USER_EMAIL: process.env.ALLOWED_USER_EMAIL || 'skyji1512@gmail.com',

  // Backend session token signing for the SPA.
  JWT_SECRET: jwtSecret,

  // Microsoft Entra ID + Outlook Calendar (Microsoft Graph API)
  // These are used for validating tokens server-side and for documentation.
  // Actual interactive sign-in + Graph token acquisition happens in the SPA via MSAL.
  MICROSOFT: {
    CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || '',
    TENANT_ID: process.env.MICROSOFT_TENANT_ID || '',
    CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || '',
    // The shared calendar owner email (manager) - optional, helps UI labeling.
    MANAGER_EMAIL: process.env.MANAGER_EMAIL || '',
    // Graph scopes used by the SPA (delegated, read-only for calendar).
    GRAPH_SCOPES: (process.env.MICROSOFT_GRAPH_SCOPES || 'Calendars.Read,User.Read,openid,profile,email').split(',').map((s) => s.trim()),
  },

  IS_PRODUCTION: process.env.NODE_ENV === 'production',
};

// Keep IS_PRODUCTION in sync with the PaaS default applied to NODE_ENV above.
config.IS_PRODUCTION = config.NODE_ENV === 'production';

function validateEnvironment() {
  const issues = [];

  // The ONLY hard requirement: where the database lives. These are real
  // credentials and must never be hardcoded into the repo (public scanners
  // pick them up within minutes) - set DATABASE_URL in the host's variables.
  if (!config.DATABASE_URL) issues.push('DATABASE_URL is required (or MONGO_URL from a Railway MongoDB template)');

  if (config.PORT <= 0 || Number.isNaN(config.PORT)) issues.push('PORT must be a positive integer');

  return { ok: issues.length === 0, issues };
}

const isProduction = () => config.NODE_ENV === 'production';

module.exports = { env: config, validateEnvironment, isProduction };
