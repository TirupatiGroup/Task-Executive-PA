// Service worker registration + update handling (Phase 7 PWA polish).
// - Registers the SW in production only.
// - Detects a waiting worker and surfaces an in-app "Update available" banner
//   with a Refresh action instead of silently swapping the app.
// - Registration failures must never break the app.

import { useEffect, useState } from 'react';

export function useServiceWorkerUpdate() {
  const [updateReady, setUpdateReady] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return undefined;

    let registration = null;

    const onInstallingStateChange = () => {
      const installing = registration?.installing;
      if (installing && installing.state === 'installed' && navigator.serviceWorker.controller) {
        // A new version finished installing while an old one still controls the page.
        setWaitingWorker(installing);
        setUpdateReady(true);
      }
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg;
        reg.addEventListener('updatefound', onInstallingStateChange);
        // Also handle a worker that is already waiting (e.g. reload before activation).
        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(reg.waiting);
          setUpdateReady(true);
        }
      })
      .catch(() => {
        /* SW registration failures must not break the app */
      });

    return () => {
      registration?.removeEventListener('updatefound', onInstallingStateChange);
    };
  }, []);

  const applyUpdate = () => {
    if (!waitingWorker) {
      // No worker to activate - a plain reload gets the latest shell.
      window.location.reload();
      return;
    }
    waitingWorker.postMessage('SKIP_WAITING');
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    }, { once: true });
  };

  return { updateReady, applyUpdate };
}
