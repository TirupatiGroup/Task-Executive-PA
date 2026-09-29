// Bridges MSAL auth state into the API layer's Graph token resolver.
// Must be rendered as a child of <MsalProvider> so useMsal() hook works.
// This ensures every /calendar/* axios call automatically attaches a valid
// Graph access token (silent refresh first, popup on interaction_required).

import { useEffect, useRef } from 'react';
import { useMicrosoftAuth } from '../../hooks/useMicrosoftAuth';
import { setGraphTokenResolver, clearGraphTokenResolver } from '../../services/api';

export function MicrosoftGraphTokenBridge({ children }) {
  const { isConfigured, instance } = useMicrosoftAuth();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!isConfigured || !instance) {
      clearGraphTokenResolver();
      return undefined;
    }

    // Async resolver used by the axios interceptor for /calendar endpoints.
    // Silent first; fallback to popup on interaction_required or other
    // recoverable MSAL errors.
    const resolver = async () => {
      if (!mountedRef.current) return null;
      try {
        const accounts = instance.getAllAccounts();
        const account = accounts[0] || undefined;
        const resp = await instance.acquireTokenSilent({
          scopes: ['Calendars.Read'],
          account,
        });
        return resp.accessToken;
      } catch (silentErr) {
        // Interaction required, or cache miss — fall back to interactive popup
        // ONLY if the browser still has a signed-in Microsoft account.
        // Otherwise the endpoint will return a clear "Graph token missing" error
        // and the Calendar page guides the user to sign in to Microsoft first.
        const accounts = instance.getAllAccounts();
        if (!accounts.length) return null;
        try {
          const resp = await instance.acquireTokenPopup({
            scopes: ['Calendars.Read'],
            account: accounts[0],
          });
          return resp.accessToken;
        } catch (_popupErr) {
          return null;
        }
      }
    };

    setGraphTokenResolver(resolver);

    return () => {
      mountedRef.current = false;
      clearGraphTokenResolver();
    };
  }, [isConfigured, instance]);

  return children || null;
}
