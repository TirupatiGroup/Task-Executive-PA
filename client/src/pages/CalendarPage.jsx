// CalendarPage - Dr. Singh's shared Outlook calendar (read-only).

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Link2, AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, CloudOff, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, Button, Loader, ErrorState, EmptyState, Select, Modal } from '../components/common';
import { PageHeader } from '../components/layout/PageHeader';
import { calendarService } from '../services/domain.services';
import { useToast } from '../context/ToastContext';
import { formatBusiness } from '../utils/format';
import { useMicrosoftAuth } from '../hooks/useMicrosoftAuth';
import { env } from '../config/env';

const VIEWS = [
  { key: 'day', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

function windowFor(view, cursor = new Date()) {
  const d = new Date(cursor);
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(d); end.setHours(23, 59, 59, 999);
  if (view === 'day') return { start, end };
  if (view === 'tomorrow') {
    const s = new Date(start); s.setDate(s.getDate() + 1);
    const e = new Date(end); e.setDate(e.getDate() + 1);
    return { start: s, end: e };
  }
  if (view === 'week') {
    const s = new Date(start); s.setDate(s.getDate() - s.getDay());
    const e = new Date(s); e.setDate(e.getDate() + 7); e.setMilliseconds(-1);
    return { start: s, end: e };
  }
  const s = new Date(d.getFullYear(), d.getMonth(), 1);
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: s, end: e };
}

export function CalendarPage() {
  const [view, setView] = useState('day');
  const [cursor, setCursor] = useState(new Date());
  const [connectOpen, setConnectOpen] = useState(false);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendar, setSelectedCalendar] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [msalLoading, setMsalLoading] = useState(false);
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { isConfigured, isSignedIn, signIn: signInMicrosoft, signOut: signOutMicrosoft, account, getToken } = useMicrosoftAuth();

  const status = useQuery({ queryKey: ['calendar-status'], queryFn: calendarService.status });

  const win = useMemo(() => windowFor(view, cursor), [view, cursor]);
  const events = useQuery({
    queryKey: ['calendar-events', view, win.start.toISOString(), win.end.toISOString()],
    queryFn: () => calendarService.events({
      start: win.start.toISOString(),
      end: win.end.toISOString(),
    }),
    enabled: !!status.data?.connected,
  });

  const handleMicrosoftSignIn = async () => {
    setMsalLoading(true);
    try {
      await signInMicrosoft();
      showToast('Microsoft account connected. Calendar access granted.');
    } catch (err) {
      if (err?.message) showToast(`Microsoft sign-in failed: ${err.message}`, 'error');
      else showToast('Microsoft sign-in cancelled or failed', 'error');
    } finally {
      setMsalLoading(false);
    }
  };

  const handleMicrosoftSignOut = async () => {
    try {
      await signOutMicrosoft();
      showToast('Signed out from Microsoft account');
    } catch (_err) {
      showToast('Microsoft sign-out failed', 'error');
    }
  };

  const refresh = async () => {
    if (!isConfigured) {
      showToast('Calendar sync is not configured yet — complete the Microsoft Entra ID setup first.', 'error');
      return;
    }
    if (!isSignedIn) {
      showToast('Please sign in to your Microsoft account first to sync the calendar', 'error');
      return;
    }
    try {
      const res = await calendarService.refresh({ start: win.start.toISOString(), end: win.end.toISOString() });
      showToast(`Synced ${res.fetched} event(s)`);
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-status'] });
    } catch (err) {
      if (/Graph token missing/i.test(err?.message || '')) {
        showToast('Microsoft sign-in required. Click "Sign in to Microsoft" on the Calendar page.', 'error');
      } else {
        showToast(err.message, 'error');
      }
    }
  };

  const openConnect = async () => {
    if (!isConfigured) {
      showToast('Microsoft Entra ID is not configured yet — see the setup steps above.', 'error');
      return;
    }
    if (!isSignedIn) {
      showToast('Please sign in to your Microsoft account first', 'error');
      return;
    }
    setConnectOpen(true);
    try {
      const res = await calendarService.calendars();
      setCalendars(res.calendars || []);
    } catch (err) {
      if (/Graph token missing/i.test(err?.message || '')) {
        showToast('Microsoft sign-in required. Please sign in to your Microsoft account first.', 'error');
      } else {
        showToast(err.message, 'error');
      }
    }
  };

  const connect = async () => {
    if (!selectedCalendar) return;
    setConnecting(true);
    try {
      const cal = calendars.find((c) => c.id === selectedCalendar);
      await calendarService.saveConnection({
        calendarId: selectedCalendar,
        label: cal?.name,
        ownerEmailAddress: cal?.owner || null,
      });
      showToast('Calendar connected');
      queryClient.invalidateQueries({ queryKey: ['calendar-status'] });
      setConnectOpen(false);
      await refresh();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setConnecting(false);
    }
  };

  const shift = (dir) => {
    const c = new Date(cursor);
    if (view === 'day' || view === 'tomorrow') c.setDate(c.getDate() + dir);
    else if (view === 'week') c.setDate(c.getDate() + 7 * dir);
    else c.setMonth(c.getMonth() + dir);
    setCursor(c);
  };

  const connected = !!status.data?.connected;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendar"
        subtitle={status.data?.calendarLabel ? `Shared calendar: ${status.data.calendarLabel}` : (env.MANAGER_EMAIL ? `Manager's shared Outlook calendar (${env.MANAGER_EMAIL})` : "Manager's shared Outlook calendar")}
        actions={(
          <>
            {isConfigured && (
              isSignedIn ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs">
                  <CheckCircle2 className="text-emerald-600" size={14} />
                  <span className="font-medium text-emerald-700 truncate max-w-[180px]">
                    {account?.username || account?.name || 'Microsoft signed in'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={handleMicrosoftSignOut} title="Sign out from Microsoft">
                    <LogOut size={13} />
                  </Button>
                </div>
              ) : (
                <Button onClick={handleMicrosoftSignIn} loading={msalLoading} variant="secondary">
                  <LogIn size={15} /> Sign in to Microsoft
                </Button>
              )
            )}
            <Button variant="secondary" onClick={refresh}>
              <RefreshCw size={15} /> Sync now
            </Button>
            <Button variant="secondary" onClick={connected ? () => setConnectOpen(true) : openConnect}>
              <Link2 size={15} /> {connected ? 'Change calendar' : 'Connect calendar'}
            </Button>
          </>
        )}
      />

      {!isConfigured && (
        <Card className="p-5 border-amber-200 bg-amber-50">
          <div className="flex flex-wrap items-start gap-3">
            <CloudOff className="mt-0.5 text-amber-600 shrink-0" size={22} />
            <div className="flex-1 min-w-[240px]">
              <p className="font-medium text-amber-900">Microsoft Entra ID setup required</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">
                Outlook calendar sync is disabled until a one-time administrator configuration is
                completed. This takes only a few minutes:
              </p>
              <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-amber-900">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-900">1</span>
                  <span>
                    Register the app in the{' '}
                    <a href="https://entra.microsoft.com" target="_blank" rel="noreferrer" className="font-medium underline decoration-amber-400 underline-offset-2 hover:decoration-amber-600">Microsoft Entra admin center</a>{' '}
                    — platform <strong>Single-page application (SPA)</strong>, redirect URI{' '}
                    <code className="rounded bg-amber-100 px-1 text-[11px]">http://localhost:5173</code>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-900">2</span>
                  <span>
                    Add delegated Microsoft Graph permissions:{' '}
                    <code className="rounded bg-amber-100 px-1 text-[11px]">openid, profile, email, User.Read, Calendars.Read</code>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-900">3</span>
                  <span>
                    Copy the <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong> into{' '}
                    <code className="rounded bg-amber-100 px-1 text-[11px]">client/.env</code> as{' '}
                    <code className="rounded bg-amber-100 px-1 text-[11px]">VITE_MSAL_CLIENT_ID</code> and{' '}
                    <code className="rounded bg-amber-100 px-1 text-[11px]">VITE_MSAL_TENANT_ID</code>, then restart the dev server.
                  </span>
                </li>
              </ol>
              <p className="mt-3 border-t border-amber-200 pt-2.5 text-xs leading-relaxed text-amber-800">
                <strong>Then:</strong> ask the manager to share their Outlook calendar with your Microsoft
                account (permission: <em>Can view all details</em>) and connect it from this page.
              </p>
            </div>
          </div>
        </Card>
      )}

      {isConfigured && !isSignedIn && !connected && (
        <Card className="p-5 border-sky-200 bg-sky-50">
          <div className="flex flex-wrap items-start gap-3">
            <CalendarDays className="mt-0.5 text-sky-600 shrink-0" size={22} />
            <div className="flex-1 min-w-[240px]">
              <p className="font-medium text-sky-900">Sign in to your Microsoft account to continue</p>
              <p className="mt-1 text-xs leading-relaxed text-sky-800">
                Calendar page aapke dwara sign-in kiye gaye Microsoft account se Outlook calendar access karta hai.
                Ye app sirf <strong>Calendars.Read</strong> permission maangta hai — email access ke liye nahi.
              </p>
              <div className="mt-3 flex gap-2">
                <Button onClick={handleMicrosoftSignIn} loading={msalLoading}>
                  <LogIn size={15} /> Sign in with Microsoft
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {!connected ? (
        <Card className="p-8 text-center">
          <CalendarDays className="mx-auto text-slate-300" size={40} />
          <p className="mt-3 text-sm font-medium text-slate-700">No shared calendar connected</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Your manager must explicitly share their Outlook calendar with your Microsoft account. Once shared, connect it
            here — the app requests only calendar permissions, never email.
          </p>
          <div className="mt-2 mx-auto max-w-md text-[11px] leading-relaxed text-slate-400">
            <strong>Setup steps (Manager side):</strong> Outlook → Calendar → Share → "Calendar permissions" → Add your Microsoft account → Grant "Can view all details" → Share.
          </div>
          <Button className="mt-4" onClick={openConnect} disabled={!isSignedIn}><Link2 size={15} /> Connect calendar</Button>
        </Card>
      ) : (
        <>
          {/* Status strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>
              Status: <span className={`font-medium ${status.data.syncStatus === 'SYNCED' ? 'text-emerald-600' : status.data.syncStatus === 'ERROR' ? 'text-red-600' : 'text-slate-600'}`}>{status.data.syncStatus}</span>
            </span>
            {status.data.lastSuccessfulSyncAt && <span>Last synced: {formatBusiness(status.data.lastSuccessfulSyncAt, 'dd MMM, h:mm a')}</span>}
            {status.data.syncStatus === 'ERROR' && status.data.lastSyncError && (
              <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle size={12} /> {status.data.lastSyncError}</span>
            )}
            <button onClick={refresh} className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {/* View switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${view === v.key ? 'bg-white text-primary-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" onClick={() => shift(-1)} aria-label="Previous"><ChevronLeft size={16} /></Button>
              <span className="min-w-32 text-center text-sm text-slate-600">
                {view === 'month' ? formatBusiness(cursor, 'MMMM yyyy') : view === 'week' ? `Week of ${formatBusiness(win.start, 'dd MMM')}` : formatBusiness(win.start, 'EEEE, dd MMM')}
              </span>
              <Button variant="ghost" onClick={() => shift(1)} aria-label="Next"><ChevronRight size={16} /></Button>
            </div>
          </div>

          {/* Events */}
          {events.isLoading ? <Loader />
          : events.isError ? <ErrorState message={events.error.message} onRetry={events.refetch} />
          : !events.data?.events?.length ? (
            <EmptyState message="No meetings in this window. Press Refresh to pull the latest from Outlook." />
          ) : (
            <Card className="divide-y divide-slate-100">
              {events.data.events.map((ev) => (
                <div key={ev.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{ev.subject || '(No title)'}</p>
                    <p className="text-xs text-slate-500">
                      {ev.isAllDay ? 'All day' : `${formatBusiness(ev.startAt, 'h:mm a')} – ${formatBusiness(ev.endAt, 'h:mm a')}`}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                    {ev.location && <span>📍 {ev.location}</span>}
                    {ev.organizerName && <span>👤 {ev.organizerName}</span>}
                    {ev.onlineMeetingUrl && <a href={ev.onlineMeetingUrl} target="_blank" rel="noreferrer" className="text-primary-700 hover:underline">Join online</a>}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {/* Connect modal */}
      <Modal open={connectOpen} onClose={() => setConnectOpen(false)} title="Connect shared calendar">
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            These are the calendars your account can see. Select the calendar your manager has shared with you.
          </p>
          <Button variant="secondary" onClick={openConnect} loading={connecting}>Reload list</Button>
          {!calendars.length ? <p className="text-sm text-slate-500">No calendars visible. Check that the manager has shared the calendar with your Microsoft account.</p> : (
            <Select
              value={selectedCalendar}
              onChange={(e) => setSelectedCalendar(e.target.value)}
              options={[{ value: '', label: 'Select a calendar…' }, ...calendars.map((c) => ({ value: c.id, label: `${c.name}${c.owner ? ` (${c.owner})` : ''}` }))]}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConnectOpen(false)}>Cancel</Button>
            <Button onClick={connect} disabled={!selectedCalendar} loading={connecting}>Connect</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
