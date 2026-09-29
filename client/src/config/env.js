// Browser-safe environment configuration.

const rawTenant = import.meta.env.VITE_MSAL_TENANT_ID || '';
const rawAuthority = import.meta.env.VITE_MSAL_AUTHORITY || '';

export const env = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '',

  // Microsoft Entra ID + Outlook Calendar (MSAL SPA)
  MSAL: {
    CLIENT_ID: import.meta.env.VITE_MSAL_CLIENT_ID || '',
    TENANT_ID: rawTenant,
    AUTHORITY: rawAuthority && !rawAuthority.includes('VITE_MSAL_TENANT_ID')
      ? rawAuthority
      : rawTenant
        ? `https://login.microsoftonline.com/${rawTenant}`
        : '',
    REDIRECT_URI: import.meta.env.VITE_MSAL_REDIRECT_URI || window.location.origin,
    POST_LOGOUT_REDIRECT_URI: import.meta.env.VITE_MSAL_POST_LOGOUT_REDIRECT_URI || window.location.origin,
    GRAPH_SCOPES: (import.meta.env.VITE_MSAL_GRAPH_SCOPES || 'Calendars.Read,User.Read,openid,profile,email')
      .split(',').map((s) => s.trim()).filter(Boolean),
    GRAPH_ENDPOINT: 'https://graph.microsoft.com/v1.0',
  },

  MANAGER_EMAIL: import.meta.env.VITE_MANAGER_EMAIL || '',

  // True when the user has filled in Entra IDs (calendar feature usable)
  hasMicrosoftConfig() {
    return !!this.MSAL.CLIENT_ID && !!this.MSAL.TENANT_ID;
  },
};
