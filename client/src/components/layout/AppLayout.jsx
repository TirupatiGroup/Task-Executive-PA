// AppLayout - responsive shell: persistent sidebar (desktop), collapsible (mobile).

import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ListTodo, Users, CalendarDays, Bell, History, Clock, AlarmClock, Mic, Settings, LogOut, Menu, X, Search, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useServiceWorkerUpdate } from '../../hooks/useServiceWorkerUpdate';
import { ReminderPoller } from './ReminderPoller';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'My Tasks', icon: ListTodo },
  { to: '/assigned', label: 'Assigned', icon: Users },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/followups', label: 'Follow-ups', icon: AlarmClock },
  { to: '/deadlines', label: 'Deadlines', icon: Clock },
  { to: '/people', label: 'People', icon: Users },
  { to: '/activity', label: 'Activity', icon: History },
  { to: '/assistant', label: 'Assistant', icon: Mic },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadBadge, setUnreadBadge] = useState(0);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { updateReady, applyUpdate } = useServiceWorkerUpdate();

  useEffect(() => {
    const handler = (e) => {
      const n = Number(e.detail?.unread || 0);
      setUnreadBadge(Number.isFinite(n) ? n : 0);
    };
    window.addEventListener('epa:unread-count', handler);
    return () => window.removeEventListener('epa:unread-count', handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navLinks = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-2">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors relative ${
              isActive ? 'bg-primary-700 text-white' : 'text-slate-600 hover:bg-primary-50 hover:text-primary-800'
            }`
          }
        >
          <span className="relative">
            <Icon size={18} />
            {to === '/notifications' && unreadBadge > 0 && (
              <span className="absolute -right-2 -top-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                {unreadBadge > 99 ? '99+' : unreadBadge}
              </span>
            )}
          </span>
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-3 md:flex">
        <Brand />
        {navLinks}
        <UserBox user={user} onSignOut={handleSignOut} />
      </aside>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 flex h-full w-64 flex-col bg-white px-3 py-3 shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button aria-label="Close menu" onClick={() => setSidebarOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            {navLinks}
            <UserBox user={user} onSignOut={handleSignOut} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top nav */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
          <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 md:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <button
            onClick={() => navigate('/search')}
            className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400 hover:border-primary-200 hover:text-slate-600"
          >
            <Search size={15} />
            <span className="truncate">Search tasks, people, follow-ups…</span>
          </button>
          <span className="hidden text-xs text-slate-400 sm:block">Asia/Kolkata</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4">
          <ReminderPoller />
          <div className="mx-auto max-w-6xl">
            {updateReady && (
              <div className="mb-3 flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm text-primary-900">
                <RefreshCw size={16} className="shrink-0 text-primary-600" />
                <span className="flex-1">A new version of Executive PA is available.</span>
                <button
                  onClick={applyUpdate}
                  className="rounded-md bg-primary-700 px-3 py-1 text-xs font-semibold text-white hover:bg-primary-800"
                >
                  Refresh
                </button>
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-800 text-sm font-bold text-accent-400">PA</span>
      <div>
        <p className="text-sm font-semibold text-slate-800">Executive PA</p>
        <p className="text-[10px] uppercase tracking-wide text-slate-400">Command centre</p>
      </div>
    </div>
  );
}

function UserBox({ user, onSignOut }) {
  return (
    <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-700">{user?.displayName || user?.email || 'Signed in'}</p>
        <p className="truncate text-[10px] text-slate-400">{user?.email}</p>
      </div>
      <button onClick={onSignOut} aria-label="Sign out" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
        <LogOut size={16} />
      </button>
    </div>
  );
}
