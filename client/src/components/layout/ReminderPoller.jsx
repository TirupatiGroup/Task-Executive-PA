// ReminderPoller - runs inside AppLayout. Every N seconds polls for unread
// notifications. When new notifications arrive since last seen: ring bell,
// fire browser notification, show in-app toast, optionally speak text.

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../../services/domain.services';
import { useToast } from '../../context/ToastContext';
import { bell, fireBrowserNotification, speak } from '../../utils/bell';
import { useAuth } from '../../context/AuthContext';

const POLL_INTERVAL_MS = 30 * 1000;

const TONE_BY_SEVERITY = { URGENT: 'URGENT', WARNING: 'WARNING' };

const SPEAK_SEVERITIES = new Set(['URGENT', 'WARNING']);

function buildSpeechLine(n) {
  switch (n.type) {
    case 'TASK_DEADLINE':
      if (n.title.startsWith('Overdue:')) return `Alert: ${n.title}. ${n.body || ''}`;
      return `Reminder: ${n.title}. ${n.body || ''}`;
    case 'FOLLOW_UP_DUE':
      return `Follow up due: ${n.title}. ${n.body || ''}`;
    case 'MEETING_REMINDER':
      return `Meeting reminder: ${n.title}. ${n.body || ''}`;
    default:
      return n.title;
  }
}

export function ReminderPoller() {
  const { status: authStatus } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const lastSeenRef = useRef(new Set());
  const firstLoadDoneRef = useRef(false);
  const settingsRef = useRef(null);

  const settings = useQuery({
    queryKey: ['reminder-settings'],
    queryFn: () => notificationService.settings(),
    enabled: authStatus === 'signed-in',
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (settings.data?.settings) {
      settingsRef.current = settings.data.settings;
    }
  }, [settings.data]);

  const notifications = useQuery({
    queryKey: ['notifications-poller'],
    queryFn: () => notificationService.list({ isRead: 'false', limit: 20 }),
    enabled: authStatus === 'signed-in',
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 15 * 1000,
  });

  useEffect(() => {
    if (!notifications.data?.items?.length) {
      if (!firstLoadDoneRef.current) firstLoadDoneRef.current = true;
      return;
    }

    const items = notifications.data.items;
    const s = settingsRef.current || {};

    if (!firstLoadDoneRef.current) {
      firstLoadDoneRef.current = true;
      const ids = new Set(items.map((x) => x.id));
      lastSeenRef.current = ids;
      return;
    }

    const newOnes = items.filter((x) => !lastSeenRef.current.has(x.id));
    if (!newOnes.length) return;

    for (const n of newOnes) {
      lastSeenRef.current.add(n.id);

      const tone = TONE_BY_SEVERITY[n.severity] || 'INFO';
      try {
        bell.play(tone);
      } catch (_) { /* ignore */ }

      try {
        showToast(`${n.title}${n.body ? ` — ${n.body}` : ''}`, n.severity === 'URGENT' || n.severity === 'WARNING' ? 'error' : undefined);
      } catch (_) { /* ignore */ }

      if (s.browserNotificationsEnabled !== false) {
        try {
          fireBrowserNotification({
            title: n.title,
            body: n.body,
            severity: n.severity,
            tag: n.dedupeKey || n.id,
            onClickUrl: n.linkPath,
          });
        } catch (_) { /* ignore */ }
      }

      if (s.voiceEnabled !== false && SPEAK_SEVERITIES.has(n.severity)) {
        try {
          speak(buildSpeechLine(n), {
            voiceEnabled: true,
            rate: s.speechRate,
            pitch: s.speechPitch,
          });
        } catch (_) { /* ignore */ }
      }
    }

    queryClient.invalidateQueries({ queryKey: ['notifications'] }).catch(() => {});

    const fiveMin = 5 * 60 * 1000;
    setTimeout(() => {
      try {
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }).catch(() => {});
      } catch (_) { /* ignore */ }
    }, fiveMin);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.data]);

  const unread = notifications.data?.unread ?? 0;
  return <BellBadgeBridge unread={unread} />;
}

// Null-rendering bridge: the unread count is needed by AppLayout's nav Bell
// badge. We expose it via a window-level custom event so AppLayout can
// subscribe without drilling props. This component renders nothing.
function BellBadgeBridge({ unread }) {
  useEffect(() => {
    const ev = new CustomEvent('epa:unread-count', { detail: { unread } });
    window.dispatchEvent(ev);
  }, [unread]);
  return null;
}
