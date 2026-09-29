// Centralized API layer. All API calls flow through this axios instance.
// - Backend session JWT is always attached from tokenStore.
// - A Microsoft Graph token resolver can be injected at runtime for Outlook calendar API calls.

import axios from 'axios';
import { env } from '../config/env';

const TOKEN_KEY = 'epa_session_token';

export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || '') + '/api/v1',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

// Optional resolver for Microsoft Graph access token used by calendar endpoints.
// Call `setGraphTokenResolver` once during app initialization with an async function
// that returns a valid Graph access token (e.g. from MSAL.acquireTokenSilent/Popup).
let graphTokenResolver = null;

export function setGraphTokenResolver(resolverFn) {
  graphTokenResolver = typeof resolverFn === 'function' ? resolverFn : null;
}

export function clearGraphTokenResolver() {
  graphTokenResolver = null;
}

// Global handler invoked whenever ANY apiCall() receives a 401.
// AuthProvider wires this up at boot so the app navigates to the login
// screen and clears session state when the backend session is no longer valid.
let globalUnauthorizedHandler = null;

export function setGlobalUnauthorizedHandler(handler) {
  globalUnauthorizedHandler = typeof handler === 'function' ? handler : null;
}

export function clearGlobalUnauthorizedHandler() {
  globalUnauthorizedHandler = null;
}

// True when the request URL targets a backend endpoint that needs the Microsoft
// Graph access token forwarded via the X-Graph-Token header.
function needsGraphToken(url = '') {
  return /\/calendar(\/|$)/i.test(url);
}

// Attach session token (always) + graph token (when resolver configured & endpoint needs it).
// The interceptor supports async resolution because acquiring a Graph token may be async.
api.interceptors.request.use(async (config) => {
  const sessionToken = tokenStore.get();
  if (sessionToken) config.headers.Authorization = `Bearer ${sessionToken}`;

  if (needsGraphToken(config.url) && typeof graphTokenResolver === 'function') {
    try {
      const graphTok = await Promise.resolve(graphTokenResolver());
      if (graphTok && typeof graphTok === 'string') {
        config.headers['X-Graph-Token'] = graphTok;
      }
    } catch (_err) {
      // Silent: backend will respond appropriately ("Graph token missing").
      // Pages can surface the error based on the API response.
    }
  }
  return config;
});

// Extracts the server's standard error payload.
export function extractApiError(error, fallback = 'Something went wrong') {
  return error?.response?.data?.message || fallback;
}

export async function apiCall(promise, { onUnauthorized } = {}) {
  try {
    const res = await promise;
    return res.data?.data ?? res.data;
  } catch (error) {
    const status = error?.response?.status;
    if (status === 401) {
      tokenStore.clear();
      if (typeof onUnauthorized === 'function') onUnauthorized();
      if (typeof globalUnauthorizedHandler === 'function') {
        try { globalUnauthorizedHandler(error); } catch (_) { /* ignore handler errors */ }
      }
    }
    const wrapped = new Error(extractApiError(error));
    wrapped.response = { status };
    throw wrapped;
  }
}
