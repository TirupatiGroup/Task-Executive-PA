// FollowUpsPage - follow-ups requiring attention + upcoming.

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, Loader, ErrorState, EmptyState } from '../components/common';
import { PageHeader } from '../components/layout/PageHeader';
import { dashboardService } from '../services/domain.services';
import { formatBusiness } from '../utils/format';

export function FollowUpsPage() {
  const navigate = useNavigate();
  const board = useQuery({ queryKey: ['followup-board'], queryFn: dashboardService.followUpBoard, refetchInterval: 120000 });

  if (board.isLoading) return <Loader label="Loading follow-ups…" />;
  if (board.isError) return <ErrorState message={board.error.message} onRetry={board.refetch} />;

  const { due, upcoming } = board.data;

  return (
    <div className="space-y-4">
      <PageHeader title="Follow-ups" subtitle="Items requiring follow-up and next follow-up dates" />

      <Card>
        <CardHeader title={`Due Now (${due.length})`} />
        {!due.length ? <EmptyState message="No follow-ups are due." />
        : (
          <ul className="divide-y divide-slate-100">
            {due.map((f) => (
              <li key={f.id}>
                <button className="w-full px-4 py-2.5 text-left hover:bg-slate-50" onClick={() => navigate(`/tasks/${f.task?.id}`)}>
                  <p className="truncate text-sm font-medium text-slate-800">{f.task?.title}</p>
                  <p className="truncate text-xs text-slate-500">{f.note}</p>
                  <p className="text-[11px] text-amber-700">Next follow-up: {formatBusiness(f.nextFollowUpAt, 'EEE dd MMM, h:mm a')}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title={`Upcoming (${upcoming.length})`} />
        {!upcoming.length ? <EmptyState message="Nothing scheduled." />
        : (
          <ul className="divide-y divide-slate-100">
            {upcoming.map((f) => (
              <li key={f.id}>
                <button className="w-full px-4 py-2.5 text-left hover:bg-slate-50" onClick={() => navigate(`/tasks/${f.task?.id}`)}>
                  <p className="truncate text-sm font-medium text-slate-800">{f.task?.title}</p>
                  <p className="truncate text-xs text-slate-500">{f.note}</p>
                  <p className="text-[11px] text-slate-400">Scheduled: {formatBusiness(f.nextFollowUpAt, 'EEE dd MMM, h:mm a')}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
