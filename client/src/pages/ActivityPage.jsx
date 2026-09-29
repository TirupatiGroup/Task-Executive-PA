// ActivityPage - business change history.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Select, Loader, ErrorState, EmptyState, Button } from '../components/common';
import { PageHeader } from '../components/layout/PageHeader';
import { activityService } from '../services/domain.services';
import { formatBusiness } from '../utils/format';

const ENTITY_OPTIONS = [
  { value: '', label: 'All entities' },
  { value: 'TASK', label: 'Tasks' },
  { value: 'PERSON', label: 'People' },
  { value: 'FOLLOW_UP', label: 'Follow-ups' },
  { value: 'CALENDAR', label: 'Calendar' },
];

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'CREATE', label: 'Created' },
  { value: 'UPDATE', label: 'Updated' },
  { value: 'STATUS_CHANGE', label: 'Status changed' },
  { value: 'COMPLETE', label: 'Completed' },
  { value: 'REOPEN', label: 'Reopened' },
  { value: 'CANCEL', label: 'Cancelled' },
  { value: 'FOLLOW_UP_ADD', label: 'Follow-up added' },
  { value: 'ARCHIVE', label: 'Archived' },
  { value: 'RESTORE', label: 'Restored' },
];

export function ActivityPage() {
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const activity = useQuery({
    queryKey: ['activity', entityType, action, page],
    queryFn: () => activityService.list({ entityType: entityType || undefined, action: action || undefined, page, limit: 30 }),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Activity History" subtitle="Important business changes, chronologically" />

      <div className="flex flex-wrap gap-3">
        <div className="w-40"><Select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} options={ENTITY_OPTIONS} /></div>
        <div className="w-44"><Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} options={ACTION_OPTIONS} /></div>
      </div>

      {activity.isLoading ? <Loader />
      : activity.isError ? <ErrorState message={activity.error.message} onRetry={activity.refetch} />
      : !activity.data?.items?.length ? <EmptyState title="No activity yet" message="Business changes will appear here as you work." />
      : (
        <>
          <Card className="px-4 py-3">
            <ol>
              {activity.data.items.map((a) => (
                <li key={a.id} className="flex items-start gap-3 border-b border-slate-100 py-2.5 last:border-0">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">{a.summary}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatBusiness(a.createdAt)} · {a.entityType} · {a.action}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          {activity.data.pagination.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Page {activity.data.pagination.page} of {activity.data.pagination.pages}</span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="secondary" disabled={page >= activity.data.pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
