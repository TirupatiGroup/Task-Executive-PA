// TaskListPage - reusable for My Tasks (/tasks) and Assigned (/assigned).

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Filter, X } from 'lucide-react';
import { Card, Button, Select, Input, Loader, ErrorState, EmptyState, StatusBadge, PriorityBadge } from '../components/common';
import { PageHeader } from '../components/layout/PageHeader';
import { TaskForm } from '../components/forms/TaskForm';
import { taskService, peopleService } from '../services/domain.services';
import { formatBusiness, TASK_STATUS_OPTIONS, TASK_PRIORITY_OPTIONS } from '../utils/format';

const QUICK_VIEWS = [
  { key: 'all', label: 'All', params: {} },
  { key: 'today', label: 'Due Today', params: { dueToday: 'true' } },
  { key: 'overdue', label: 'Overdue', params: { overdue: 'true' } },
  { key: 'priority', label: 'High/Critical', params: { priority: 'HIGH' } },
  { key: 'active', label: 'Active', params: { active: 'true' } },
  { key: 'completed', label: 'Completed', params: { completed: 'true' } },
];

export function TaskListPage({ mode = 'personal' }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const filters = useMemo(() => ({
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    assigneeId: searchParams.get('assigneeId') || '',
    search: searchParams.get('search') || '',
    dueToday: searchParams.get('dueToday') || '',
    overdue: searchParams.get('overdue') || '',
    active: searchParams.get('active') || '',
    completed: searchParams.get('completed') || '',
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortDir: searchParams.get('sortDir') || 'desc',
    page: parseInt(searchParams.get('page') || '1', 10),
  }), [searchParams]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  };

  const params = { ...filters, limit: 20 };
  if (mode === 'personal') params.taskType = 'PERSONAL';
  if (mode === 'assigned') params.taskType = 'ASSIGNED';
  Object.keys(params).forEach((k) => (params[k] === '' || params[k] == null) && delete params[k]);

  const tasks = useQuery({ queryKey: ['tasks', mode, params], queryFn: () => taskService.list(params) });
  const people = useQuery({ queryKey: ['people', 'active'], queryFn: () => peopleService.list({ isActive: 'true', limit: 100 }) });

  const title = mode === 'assigned' ? 'Assigned Tasks' : 'My Tasks';
  const subtitle = mode === 'assigned' ? 'Work delegated to others' : 'Personal task list';

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={(
          <>
            <Button variant="secondary" onClick={() => setShowFilters((s) => !s)} className="lg:hidden">
              <Filter size={15} /> Filters
            </Button>
            <Button onClick={() => setFormOpen(true)}><Plus size={15} /> New Task</Button>
          </>
        )}
      />

      {/* Quick views */}
      <div className="flex flex-wrap gap-2">
        {QUICK_VIEWS.map((v) => {
          const active = Object.entries(v.params).every(([k, val]) => searchParams.get(k) === val)
            && Object.keys(v.params).length > 0;
          return (
            <button
              key={v.key}
              onClick={() => {
                const next = new URLSearchParams();
                if (mode === 'personal') next.set('taskType', 'PERSONAL');
                if (mode === 'assigned') next.set('taskType', 'ASSIGNED');
                Object.entries(v.params).forEach(([k, val]) => next.set(k, val));
                setSearchParams(next);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active ? 'bg-primary-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-primary-300'
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className={`${showFilters ? 'block' : 'hidden'} lg:block`}>
        <Card className="p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input placeholder="Search title…" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
            <Select
              value={filters.status}
              onChange={(e) => setFilter('status', e.target.value)}
              options={[{ value: '', label: 'All statuses' }, ...TASK_STATUS_OPTIONS]}
            />
            <Select
              value={filters.priority}
              onChange={(e) => setFilter('priority', e.target.value)}
              options={[{ value: '', label: 'All priorities' }, ...TASK_PRIORITY_OPTIONS]}
            />
            {mode === 'assigned' && (
              <Select
                value={filters.assigneeId}
                onChange={(e) => setFilter('assigneeId', e.target.value)}
                options={[{ value: '', label: 'All assignees' }, ...(people.data?.people || []).map((p) => ({ value: p.id, label: p.name }))]}
              />
            )}
            <Select
              value={`${filters.sortBy}:${filters.sortDir}`}
              onChange={(e) => {
                const [sortBy, sortDir] = e.target.value.split(':');
                setFilter('sortBy', sortBy);
                setFilter('sortDir', sortDir);
              }}
              options={[
                { value: 'createdAt:desc', label: 'Newest first' },
                { value: 'dueDate:asc', label: 'Due date ↑' },
                { value: 'dueDate:desc', label: 'Due date ↓' },
                { value: 'priority:desc', label: 'Priority ↓' },
              ]}
            />
          </div>
          {Object.keys(searchParams).length > 0 && (
            <button className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700" onClick={() => setSearchParams(new URLSearchParams())}>
              <X size={12} /> Clear filters
            </button>
          )}
        </Card>
      </div>

      {/* List */}
      {tasks.isLoading ? <Loader label="Loading tasks…" />
        : tasks.isError ? <ErrorState message={tasks.error.message} onRetry={tasks.refetch} />
        : !tasks.data?.tasks?.length ? <EmptyState title="No tasks found" message="Adjust filters or create a new task." />
        : (
          <Card className="divide-y divide-slate-100">
            {tasks.data.tasks.map((t) => (
              <button key={t.id} onClick={() => navigate(`/tasks/${t.id}`)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-800">{t.title}</span>
                    {t.isOverdue && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">OVERDUE</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {t.assignee ? `${t.assignee.name} · ` : ''}
                    {t.dueDate ? `Due ${formatBusiness(t.dueDate, 'dd MMM, h:mm a')}` : 'No due date'}
                    {' · '}{t.followUps?.length || 0} follow-up(s)
                    {t.attachments?.length ? ` · 📎 ${t.attachments.length}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                </span>
              </button>
            ))}
          </Card>
        )}

      {/* Pagination */}
      {tasks.data?.pagination && tasks.data.pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Page {tasks.data.pagination.page} of {tasks.data.pagination.pages} ({tasks.data.pagination.total} tasks)</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={tasks.data.pagination.page <= 1} onClick={() => setFilter('page', String(filters.page - 1))}>Previous</Button>
            <Button variant="secondary" disabled={tasks.data.pagination.page >= tasks.data.pagination.pages} onClick={() => setFilter('page', String(filters.page + 1))}>Next</Button>
          </div>
        </div>
      )}

      <TaskForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
