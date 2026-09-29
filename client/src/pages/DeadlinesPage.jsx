// DeadlinesPage - due today, this week, later and overdue.

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, Loader, ErrorState, EmptyState, StatusBadge, PriorityBadge } from '../components/common';
import { PageHeader } from '../components/layout/PageHeader';
import { dashboardService } from '../services/domain.services';
import { formatBusiness } from '../utils/format';

export function DeadlinesPage() {
  const navigate = useNavigate();
  const board = useQuery({ queryKey: ['deadline-board'], queryFn: dashboardService.deadlineBoard, refetchInterval: 120000 });

  if (board.isLoading) return <Loader label="Loading deadlines…" />;
  if (board.isError) return <ErrorState message={board.error.message} onRetry={board.refetch} />;

  const { overdue, dueToday, thisWeek, later } = board.data;

  return (
    <div className="space-y-4">
      <PageHeader title="Deadlines" subtitle="Due today, upcoming and overdue work" />

      <Section title={`Overdue (${overdue.length})`} tone="danger" tasks={overdue} onOpen={(id) => navigate(`/tasks/${id}`)} />
      <Section title={`Due Today (${dueToday.length})`} tone="accent" tasks={dueToday} onOpen={(id) => navigate(`/tasks/${id}`)} />
      <Section title={`This Week (${thisWeek.length})`} tasks={thisWeek} onOpen={(id) => navigate(`/tasks/${id}`)} />
      <Section title={`Later (${later.length})`} tasks={later} onOpen={(id) => navigate(`/tasks/${id}`)} />
    </div>
  );
}

function Section({ title, tasks, onOpen, tone = 'default' }) {
  const toneClasses = {
    danger: 'text-red-700',
    accent: 'text-accent-700',
    default: 'text-slate-800',
  };
  return (
    <Card>
      <CardHeader title={<span className={toneClasses[tone]}>{title}</span>} />
      {!tasks.length ? <EmptyState message="Nothing here." />
      : (
        <ul className="divide-y divide-slate-100">
          {tasks.map((t) => (
            <li key={t.id}>
              <button onClick={() => onOpen(t.id)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">{t.title}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {t.assignee ? `${t.assignee.name} · ` : ''}
                    {t.dueDate ? formatBusiness(t.dueDate, 'EEE dd MMM, h:mm a') : 'No due date'}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
