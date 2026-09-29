// MSAL configuration + PublicClientApplication factory for Microsoft Entra ID.
// Used by MsalProvider in main.jsx and by the calendar page for Graph tokens.
// Flow: Authorization Code + PKCE (SPA, no client secret).

import { LogLevel, PublicClientApplication } from '@azure/msal-browser';
import { env } from '../config/env';

const msalBaseLoggerOptions = {
  loggerCallback: (level, message) => {
    if (level <= LogLevel.Error) {
      // eslint-disable-next-line no-console
      console.error('[MSAL]', message);
    }
  },
  piiLoggingEnabled: false,
};

export function buildMsalConfig() {
  const clientId = env.MSAL.CLIENT_ID;
  const authority = env.MSAL.AUTHORITY;
  const redirectUri = env.MSAL.REDIRECT_URI;

  return {
    auth: {
      clientId,
      authority,
      redirectUri,
      postLogoutRedirectUri: env.MSAL.POST_LOGOUT_REDIRECT_URI,
      navigateToLoginRequestUrl: true,
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false,
    },
    system: {
      loggerOptions: msalBaseLoggerOptions,
      windowHashTimeout: 60000,
      iframeHashTimeout: 12000,
    },
  };
}

// Singleton PublicClientApplication — created once when IDs are configured.
let msalInstance = null;

export function getMsalInstance() {
  if (msalInstance) return msalInstance;
  if (!env.hasMicrosoftConfig()) {
    return null;
  }
  const config = buildMsalConfig();
  msalInstance = new PublicClientApplication(config);
  return msalInstance;
}

// Scopes we request for signing the user into Microsoft + reading Outlook calendar.
export const LOGIN_SCOPES = env.MSAL.GRAPH_SCOPES;
export const CALENDAR_SCOPES = ['Calendars.Read'];

// Convert scope arrays into the full URL form required for on-behalf Graph calls
// (most MSAL calls accept short form too, but explicit is safer).
export function graphScopesFull() {
  return CALENDAR_SCOPES.map((s) =>
    s.startsWith('https://') ? s : `https://graph.microsoft.com/${s}`,
  );
}

// Try to acquire a Graph access token silently. Falls back to interactive login prompt.
export async function acquireGraphToken(instance, { interactive = true, scopes = CALENDAR_SCOPES } = {}) {
  if (!instance) {
    const err = new Error('Microsoft Entra ID is not configured. Fill VITE_MSAL_CLIENT_ID and VITE_MSAL_TENANT_ID in client/.env');
    err.code = 'MSAL_NOT_CONFIGURED';
    throw err;
  }
  const accounts = instance.getAllAccounts();
  const account = accounts[0] || null;
  const request = { scopes, account: account || undefined };

  try {
    const response = await instance.acquireTokenSilent(request);
    return response.accessToken;
  } catch (silentErr) {
    if (!interactive) throw silentErr;
    const response = await instance.acquireTokenPopup(request);
    return response.accessToken;
  }
}

export function isMicrosoftSignedIn(instance) {
  if (!instance) return false;
  return instance.getAllAccounts().length > 0;
}
