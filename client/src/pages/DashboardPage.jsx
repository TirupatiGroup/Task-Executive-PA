// Dashboard - live command centre.

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ListTodo, AlarmClock, Clock, AlertTriangle, CheckCircle2, Briefcase } from 'lucide-react';
import { Card, CardHeader, Loader, ErrorState, StatusBadge, PriorityBadge, EmptyState } from '../components/common';
import { PageHeader } from '../components/layout/PageHeader';
import { SummaryCard } from '../components/layout/SummaryCard';
import { dashboardService, briefingService } from '../services/domain.services';
import { formatBusiness } from '../utils/format';

export function DashboardPage() {
  const navigate = useNavigate();
  const summary = useQuery({ queryKey: ['dashboard-summary'], queryFn: dashboardService.summary, refetchInterval: 60000 });
  const briefing = useQuery({ queryKey: ['briefing'], queryFn: briefingService.today, refetchInterval: 300000 });

  if (summary.isLoading) return <Loader label="Loading command centre…" />;
  if (summary.isError) return <ErrorState message={summary.error.message} onRetry={summary.refetch} />;

  const { counts, lists } = summary.data;
  const d = summary.data;


  return (
    <div className="space-y-4">
      <PageHeader
        title="Command Dashboard"
        subtitle={briefing.data?.date || 'Your day at a glance'}
      />

      {briefing.data?.summary && (
        <Card className="border-primary-100 bg-primary-50/60 p-4">
          <div className="flex items-start gap-3">
            <Briefcase className="mt-0.5 shrink-0 text-primary-700" size={18} />
            <div>
              <p className="text-sm font-medium text-primary-900">Today&apos;s briefing</p>
              <p className="mt-1 text-sm text-primary-800">{briefing.data.summary}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Today's Meetings" value={d.meetingsCount ?? '--'} icon={CalendarDays} onClick={() => navigate('/calendar')} />
        <SummaryCard label="My Active Tasks" value={counts.myTasksActive} icon={ListTodo} onClick={() => navigate('/tasks')} />
        <SummaryCard label="Assigned Active" value={counts.assignedActive} icon={Briefcase} onClick={() => navigate('/assigned')} />
        <SummaryCard label="Follow-ups Due" value={counts.dueFollowUps} icon={AlarmClock} onClick={() => navigate('/followups')} />
        <SummaryCard label="Deadlines Today" value={counts.dueToday} icon={Clock} onClick={() => navigate('/deadlines')} accent />
        <SummaryCard label="Overdue" value={counts.overdue} icon={AlertTriangle} onClick={() => navigate('/deadlines')} accent />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Today's meetings (Phase 4) */}
        <Card>
          <CardHeader title="Today's Meetings" subtitle="From Dr. Singh's shared calendar" action={<button className="text-xs font-medium text-primary-700 hover:underline" onClick={() => navigate('/calendar')}>View calendar</button>} />
          <MeetingList items={d.todayMeetings || []} />
        </Card>

        {/* Due today */}
        <Card>
          <CardHeader title="Due Today" action={<button className="text-xs font-medium text-primary-700 hover:underline" onClick={() => navigate('/deadlines')}>All deadlines</button>} />
          <TaskMiniList tasks={lists.dueTodayTasks} emptyMessage="No tasks due today." />
        </Card>

        {/* Overdue */}
        <Card>
          <CardHeader title="Overdue" action={<button className="text-xs font-medium text-primary-700 hover:underline" onClick={() => navigate('/deadlines')}>All overdue</button>} />
          <TaskMiniList tasks={lists.overdueTasks} emptyMessage="Nothing overdue. Great!" />
        </Card>

        {/* Priority */}
        <Card>
          <CardHeader title="High Priority" />
          <TaskMiniList tasks={lists.priorityTasks} emptyMessage="No high-priority tasks." showPriority />
        </Card>

        {/* Follow-ups */}
        <Card>
          <CardHeader title="Follow-ups Due" action={<button className="text-xs font-medium text-primary-700 hover:underline" onClick={() => navigate('/followups')}>All follow-ups</button>} />
          <FollowUpList items={lists.dueFollowUps} />
        </Card>

        {/* Recently completed */}
        <Card>
          <CardHeader title="Recently Completed" />
          <TaskMiniList tasks={lists.recentlyCompleted} emptyMessage="Nothing completed yet." showCompletedAt />
        </Card>
      </div>
    </div>
  );
}

function TaskMiniList({ tasks, emptyMessage, showPriority, showCompletedAt }) {
  if (!tasks?.length) return <EmptyState message={emptyMessage} />;
  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((t) => (
        <li key={t.id}>
          <button onClick={() => window.location.assign(`/tasks/${t.id}`)} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-slate-50">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-800">{t.title}</span>
              <span className="block truncate text-xs text-slate-500">
                {t.assignee ? `${t.assignee.name} · ` : ''}
                {t.dueDate ? `Due ${formatBusiness(t.dueDate, 'dd MMM h:mm a')}` : 'No due date'}
                {showCompletedAt && t.completedAt ? ` · Done ${formatBusiness(t.completedAt, 'dd MMM, h:mm a')}` : ''}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {showPriority && <PriorityBadge priority={t.priority} />}
              {t.isOverdue && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">OVERDUE</span>}
              <StatusBadge status={t.status} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function FollowUpList({ items }) {
  if (!items?.length) return <EmptyState message="No follow-ups due." />;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((f) => (
        <li key={f.id} className="px-4 py-2.5">
          <button className="w-full text-left" onClick={() => window.location.assign(`/tasks/${f.task?.id}`)}>
            <span className="block truncate text-sm font-medium text-slate-800">{f.task?.title}</span>
            <span className="block truncate text-xs text-slate-500">{f.note}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function MeetingList({ items }) {
  if (!items?.length) return <EmptyState message="No meetings today. Calendar integration activates once the shared calendar is connected (Settings → Calendar)." />;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((m) => (
        <li key={m.id} className="px-4 py-2.5">
          <p className="truncate text-sm font-medium text-slate-800">{m.subject || '(No title)'}</p>
          <p className="text-xs text-slate-500">
            {formatBusiness(m.startAt, 'h:mm a')} – {formatBusiness(m.endAt, 'h:mm a')}
            {m.location ? ` · ${m.location}` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}
