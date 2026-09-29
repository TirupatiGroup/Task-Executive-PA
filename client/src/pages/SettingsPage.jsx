// SettingsPage - reminder/briefing/voice preferences + notifications permission + export.

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Download, Mic } from 'lucide-react';
import { Card, CardHeader, Button, Input, Loader, ErrorState } from '../components/common';
import { PageHeader } from '../components/layout/PageHeader';
import { notificationService } from '../services/domain.services';
import { useToast } from '../context/ToastContext';

export function SettingsPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['reminder-settings'], queryFn: notificationService.settings });
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notifPermission, setNotifPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  useEffect(() => {
    if (settings.data?.settings) setForm(settings.data.settings);
  }, [settings.data]);

  if (settings.isLoading) return <Loader />;
  if (settings.isError) return <ErrorState message={settings.error.message} onRetry={settings.refetch} />;
  if (!form) return null;

  const save = async () => {
    setSaving(true);
    try {
      await notificationService.updateSettings({
        briefingTime: form.briefingTime,
        briefingEnabled: form.briefingEnabled,
        defaultTaskLeadHours: Number(form.defaultTaskLeadHours),
        defaultFollowUpLeadHours: Number(form.defaultFollowUpLeadHours),
        defaultMeetingLeadMinutes: Number(form.defaultMeetingLeadMinutes),
        browserNotificationsEnabled: form.browserNotificationsEnabled,
        voiceEnabled: form.voiceEnabled,
        speechRate: Number(form.speechRate),
        speechPitch: Number(form.speechPitch),
      });
      showToast('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['reminder-settings'] });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      showToast(result === 'granted' ? 'Browser notifications enabled' : `Permission ${result}`);
    } catch {
      showToast('Could not request notification permission', 'error');
    }
  };

  const exportData = () => {
    // Client-side convenience export of the main lists via existing APIs.
    showToast('Preparing export…');
    Promise.all([
      import('../services/domain.services').then((m) => m.taskService.list({ limit: 100 })),
      import('../services/domain.services').then((m) => m.peopleService.list({ limit: 100 })),
    ]).then(([tasks, people]) => {
      const payload = { exportedAt: new Date().toISOString(), tasks: tasks.tasks, people: people.people };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `executive-pa-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Export downloaded');
    }).catch(() => showToast('Export failed', 'error'));
  };

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle="Reminder, briefing and notification preferences" />

      <Card>
        <CardHeader title="Daily briefing" subtitle="Morning summary of your day" />
        <div className="space-y-3 px-4 py-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.briefingEnabled} onChange={(e) => set('briefingEnabled', e.target.checked)} className="rounded border-slate-300" />
            Show daily briefing on dashboard
          </label>
          <div className="max-w-32">
            <Input label="Briefing time" type="time" value={form.briefingTime} onChange={(e) => set('briefingTime', e.target.value)} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Reminder lead times" subtitle="How early to alert before deadlines and meetings" />
        <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-3">
          <Input label="Task lead (hours)" type="number" min="0" max="168" value={form.defaultTaskLeadHours} onChange={(e) => set('defaultTaskLeadHours', e.target.value)} />
          <Input label="Follow-up lead (hours)" type="number" min="0" max="168" value={form.defaultFollowUpLeadHours} onChange={(e) => set('defaultFollowUpLeadHours', e.target.value)} />
          <Input label="Meeting lead (minutes)" type="number" min="0" max="1440" value={form.defaultMeetingLeadMinutes} onChange={(e) => set('defaultMeetingLeadMinutes', e.target.value)} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Browser notifications" subtitle="Optional — in-app alerts always work" />
        <div className="space-y-3 px-4 py-4">
          <p className="text-sm text-slate-600">
            Permission: <span className={`font-medium ${notifPermission === 'granted' ? 'text-emerald-600' : notifPermission === 'denied' ? 'text-red-600' : 'text-slate-600'}`}>{notifPermission}</span>
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.browserNotificationsEnabled}
              onChange={(e) => {
                const checked = e.target.checked;
                set('browserNotificationsEnabled', checked);
                if (checked && typeof Notification !== 'undefined' && Notification.permission === 'default') {
                  requestPermission();
                }
              }}
              className="rounded border-slate-300"
            />
            Also show browser notifications (when permitted)
          </label>
          {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
            <Button variant="secondary" onClick={requestPermission}><Bell size={15} /> Request permission</Button>
          )}
          {notifPermission === 'denied' && (
            <p className="text-xs text-amber-700">Permission was denied — in-app notification centre remains fully usable.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Voice assistant" subtitle="Speech output preferences" />
        <div className="space-y-3 px-4 py-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.voiceEnabled} onChange={(e) => set('voiceEnabled', e.target.checked)} className="rounded border-slate-300" />
            <Mic size={14} /> Enable voice assistant
          </label>
          <div className="grid max-w-md grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Speech rate: {form.speechRate}</label>
              <input type="range" min="0.5" max="2" step="0.1" value={form.speechRate} onChange={(e) => set('speechRate', e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Speech pitch: {form.speechPitch}</label>
              <input type="range" min="0.5" max="2" step="0.1" value={form.speechPitch} onChange={(e) => set('speechPitch', e.target.value)} className="w-full" />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Data export" subtitle="Download your tasks and directory as JSON" />
        <div className="px-4 py-4">
          <Button variant="secondary" onClick={exportData}><Download size={15} /> Export data</Button>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>Save settings</Button>
      </div>
    </div>
  );
}
