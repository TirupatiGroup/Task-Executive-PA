// PeoplePage - assignee directory.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, UserX, UserCheck, Search } from 'lucide-react';
import { Card, Button, Input, Loader, ErrorState, EmptyState, ConfirmDialog } from '../components/common';
import { PageHeader } from '../components/layout/PageHeader';
import { PersonForm } from '../components/forms/PersonForm';
import { peopleService } from '../services/domain.services';
import { useToast } from '../context/ToastContext';

export function PeoplePage() {
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmToggle, setConfirmToggle] = useState(null);
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const people = useQuery({
    queryKey: ['people', search, showInactive],
    queryFn: () => peopleService.list({ search: search || undefined, isActive: showInactive ? undefined : 'true' }),
  });

  const toggleStatus = async () => {
    const person = confirmToggle;
    setConfirmToggle(null);
    try {
      await peopleService.setStatus(person.id, !person.isActive);
      showToast(`${person.name} ${person.isActive ? 'deactivated' : 'activated'}`);
      queryClient.invalidateQueries({ queryKey: ['people'] });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="People"
        subtitle="Assignee directory for tasks and follow-ups"
        actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={15} /> Add Person</Button>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded border-slate-300" />
          Show deactivated
        </label>
      </div>

      {people.isLoading ? <Loader />
      : people.isError ? <ErrorState message={people.error.message} onRetry={people.refetch} />
      : !people.data?.people?.length ? <EmptyState title="No people yet" message="Add the colleagues you delegate work to." />
      : (
        <Card className="divide-y divide-slate-100">
          {people.data.people.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  {p.name}
                  {!p.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-500">INACTIVE</span>}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {[p.designation, p.department].filter(Boolean).join(' · ') || '—'}
                  {p.email ? ` · ${p.email}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button variant="ghost" onClick={() => { setEditing(p); setFormOpen(true); }} aria-label="Edit"><Pencil size={15} /></Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmToggle(p)}
                  aria-label={p.isActive ? 'Deactivate' : 'Activate'}
                >
                  {p.isActive ? <UserX size={15} className="text-red-500" /> : <UserCheck size={15} className="text-emerald-600" />}
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <PersonForm open={formOpen} onClose={() => setFormOpen(false)} person={editing} />
      <ConfirmDialog
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={toggleStatus}
        title={confirmToggle?.isActive ? 'Deactivate person' : 'Activate person'}
        message={confirmToggle?.isActive
          ? `Deactivate ${confirmToggle?.name}? They cannot be assigned new tasks while inactive.`
          : `Reactivate ${confirmToggle?.name}?`}
        confirmLabel={confirmToggle?.isActive ? 'Deactivate' : 'Activate'}
      />
    </div>
  );
}
