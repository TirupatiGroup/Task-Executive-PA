// Auth service - email + password login against the backend.
// Session token is a backend-minted JWT kept in sessionStorage.

import { api, apiCall, tokenStore } from './api';

export const authService = {
  async signIn(email, password) {
    const data = await apiCall(api.post('/auth/login', { email, password }));
    tokenStore.set(data.sessionToken);
    return data;
  },

  async fetchMe() {
    return apiCall(api.get('/auth/me'));
  },

  async logout() {
    try {
      await apiCall(api.post('/auth/logout'));
    } catch { /* best effort */ }
    tokenStore.clear();
  },
};
