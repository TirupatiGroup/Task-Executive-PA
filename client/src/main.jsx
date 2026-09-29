import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MsalProvider } from '@azure/msal-react';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppRoutes } from './routes/AppRoutes';
import { MicrosoftGraphTokenBridge } from './components/layout/MicrosoftGraphTokenBridge';
import { getMsalInstance } from './services/msal.service';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        if (status === 401 || status === 403 || failureCount > 0) return false;
        return true;
      },
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
    mutations: {
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        if (status === 401 || status === 403 || failureCount > 0) return false;
        return true;
      },
    },
  },
});

// Wrap with MsalProvider only when Microsoft Entra IDs are actually configured.
// If not configured, MsalProvider is skipped entirely so the rest of the app
// (tasks, reminders, assistant) still works perfectly without calendar auth.
const msalInstance = getMsalInstance();

function AppRoot() {
  const tree = (
    <MicrosoftGraphTokenBridge>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </MicrosoftGraphTokenBridge>
  );

  if (msalInstance) {
    return <MsalProvider instance={msalInstance}>{tree}</MsalProvider>;
  }
  return tree;
}

// PWA service worker registration + update handling lives in
// useServiceWorkerUpdate() (mounted inside AppLayout) so registration only
// happens once and updates can surface an in-app banner.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoot />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
