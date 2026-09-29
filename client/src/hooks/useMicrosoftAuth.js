// useMicrosoftAuth hook — convenience wrapper around msal-react hooks + raw MSAL.
// Provides: isConfigured, isSignedIn, account, acquireToken, signIn, signOut, status.

import { useCallback, useMemo } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { env } from '../config/env';
import { CALENDAR_SCOPES, acquireGraphToken } from '../services/msal.service';

export function useMicrosoftAuth() {
  const { instance } = useMsal();
  const msalAuthenticated = useIsAuthenticated();

  const isConfigured = useMemo(() => env.hasMicrosoftConfig(), []);
  const isSignedIn = isConfigured && msalAuthenticated;

  const status = useMemo(() => {
    if (!isConfigured) return 'not-configured';
    if (isSignedIn) return 'signed-in';
    return 'signed-out';
  }, [isConfigured, isSignedIn]);

  const account = useMemo(() => {
    if (!instance) return null;
    const accounts = instance.getAllAccounts();
    return accounts[0] || null;
  }, [instance]);

  const getToken = useCallback(
    async ({ interactive = true, scopes = CALENDAR_SCOPES } = {}) =>
      acquireGraphToken(instance, { interactive, scopes }),
    [instance],
  );

  const signIn = useCallback(async () => {
    if (!instance) throw new Error('Microsoft auth not configured');
    const result = await instance.loginPopup({
      scopes: env.MSAL.GRAPH_SCOPES,
      prompt: 'select_account',
    });
    return result;
  }, [instance]);

  const signOut = useCallback(async () => {
    if (!instance) return;
    await instance.logoutPopup({
      mainWindowRedirectUri: env.MSAL.POST_LOGOUT_REDIRECT_URI,
    });
  }, [instance]);

  return {
    isConfigured,
    isSignedIn,
    status,
    account,
    instance,
    getToken,
    signIn,
    signOut,
  };
}
