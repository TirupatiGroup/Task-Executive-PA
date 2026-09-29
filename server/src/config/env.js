// Centralized environment configuration + startup validation.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  DATABASE_URL: process.env.DATABASE_URL || '',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:4000',

  // Single approved account (email + password auth).
  ALLOWED_USER_EMAIL: process.env.ALLOWED_USER_EMAIL || '',

  // Backend session token signing for the SPA.
  JWT_SECRET: process.env.JWT_SECRET || '',

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

function validateEnvironment() {
  const issues = [];

  if (!config.DATABASE_URL) issues.push('DATABASE_URL is required');
  if (!config.ALLOWED_USER_EMAIL) issues.push('ALLOWED_USER_EMAIL is required');

  if (config.IS_PRODUCTION) {
    if (!config.JWT_SECRET) issues.push('JWT_SECRET is required in production');
    if (config.JWT_SECRET && config.JWT_SECRET.length < 32) {
      issues.push('JWT_SECRET must be at least 32 characters in production');
    }
  }

  if (config.PORT <= 0 || Number.isNaN(config.PORT)) issues.push('PORT must be a positive integer');

  return { ok: issues.length === 0, issues };
}

const isProduction = () => config.NODE_ENV === 'production';

module.exports = { env: config, validateEnvironment, isProduction };
