// NotificationsPage - in-app notification centre.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { Card, Button, Loader, ErrorState, EmptyState, Select } from '../components/common';
import { PageHeader } from '../components/layout/PageHeader';
import { notificationService } from '../services/domain.services';
import { useToast } from '../context/ToastContext';
import { formatBusiness } from '../utils/format';

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'TASK_DEADLINE', label: 'Deadlines' },
  { value: 'FOLLOW_UP_DUE', label: 'Follow-ups' },
  { value: 'MEETING_REMINDER', label: 'Meetings' },
  { value: 'SYSTEM', label: 'System' },
];

const SEVERITY_STYLES = {
  URGENT: 'border-l-red-500',
  WARNING: 'border-l-amber-400',
  INFO: 'border-l-primary-400',
};

export function NotificationsPage() {
  const [type, setType] = useState('');
  const [showUnread, setShowUnread] = useState(false);
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const notifications = useQuery({
    queryKey: ['notifications', type, showUnread],
    queryFn: () => notificationService.list({ type: type || undefined, isRead: showUnread ? 'false' : undefined, limit: 50 }),
    refetchInterval: 60000,
  });

  const refreshNow = async () => {
    try {
      await notificationService.runScheduler();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showToast('Reminder check complete');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const markAll = async () => {
    try {
      await notificationService.markAllRead();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const toggleRead = async (n) => {
    try {
      await notificationService.setRead(n.id, !n.isRead);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const openNotification = async (n) => {
    if (!n.isRead) await toggleRead(n);
    if (n.linkPath) window.location.assign(n.linkPath);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        subtitle={notifications.data ? `${notifications.data.unread} unread` : 'Reminders, deadlines and alerts'}
        actions={(
          <>
            <Button variant="secondary" onClick={refreshNow}><RefreshCw size={14} /> Check now</Button>
            <Button variant="secondary" onClick={markAll}><CheckCheck size={14} /> Mark all read</Button>
          </>
        )}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44"><Select value={type} onChange={(e) => setType(e.target.value)} options={TYPE_OPTIONS} /></div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showUnread} onChange={(e) => setShowUnread(e.target.checked)} className="rounded border-slate-300" />
          Unread only
        </label>
      </div>

      {notifications.isLoading ? <Loader />
      : notifications.isError ? <ErrorState message={notifications.error.message} onRetry={notifications.refetch} />
      : !notifications.data?.items?.length ? <EmptyState title="No notifications" message="Deadline, follow-up and meeting reminders appear here." />
      : (
        <Card className="divide-y divide-slate-100">
          {notifications.data.items.map((n) => (
            <button
              key={n.id}
              onClick={() => openNotification(n)}
              className={`flex w-full items-start gap-3 border-l-4 px-4 py-3 text-left hover:bg-slate-50 ${SEVERITY_STYLES[n.severity] || 'border-l-slate-300'} ${!n.isRead ? 'bg-primary-50/40' : ''}`}
            >
              <Bell size={16} className={`mt-0.5 shrink-0 ${n.isRead ? 'text-slate-300' : 'text-primary-600'}`} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm ${!n.isRead ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{n.title}</span>
                {n.body && <span className="block truncate text-xs text-slate-500">{n.body}</span>}
                <span className="block text-[11px] text-slate-400">{formatBusiness(n.createdAt, 'dd MMM, h:mm a')} · {n.type.replace(/_/g, ' ').toLowerCase()}</span>
              </span>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
