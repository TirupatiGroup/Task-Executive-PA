// Auth context - holds the backend session state.

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { tokenStore, setGlobalUnauthorizedHandler, clearGlobalUnauthorizedHandler } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading | signed-out | signed-in
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const signingOutRef = useRef(false);

  const signOut = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setUser(null);
    setStatus('signed-out');
    try {
      await authService.logout();
    } catch (_) { /* ignore */ }
    navigate('/login', { replace: true });
    signingOutRef.current = false;
  }, [navigate]);

  const init = useCallback(async () => {
    try {
      if (tokenStore.get()) {
        const me = await authService.fetchMe();
        setUser(me.user);
        setStatus('signed-in');
        return;
      }
      setStatus('signed-out');
    } catch {
      tokenStore.clear();
      setStatus('signed-out');
    }
  }, []);

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    const handler = () => {
      signOut();
    };
    setGlobalUnauthorizedHandler(handler);
    return () => clearGlobalUnauthorizedHandler();
  }, [signOut]);

  const signIn = async (email, password) => {
    setStatus('loading');
    try {
      const data = await authService.signIn(email, password);
      setUser(data.user);
      setStatus('signed-in');
    } catch (err) {
      setStatus('signed-out');
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ status, user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
