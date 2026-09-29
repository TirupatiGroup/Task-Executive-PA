// SearchPage - cross-entity private search.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { Card, CardHeader, Loader, EmptyState } from '../components/common';
import { PageHeader } from '../components/layout/PageHeader';
import { searchService } from '../services/domain.services';
import { formatBusiness } from '../utils/format';

export function SearchPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');

  const results = useQuery({
    queryKey: ['search', submitted],
    queryFn: () => searchService.query(submitted),
    enabled: submitted.length > 0,
  });

  const onSubmit = (e) => {
    e.preventDefault();
    setSubmitted(q.trim().slice(0, 80));
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Search" subtitle="Find tasks, people and follow-ups" />

      <form onSubmit={onSubmit} className="relative">
        <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search everything…"
          autoFocus
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
      </form>

      {!submitted ? (
        <EmptyState message="Type a query above — search covers task titles/descriptions, people and follow-up notes." />
      ) : results.isLoading ? <Loader label="Searching…" />
      : results.isError ? <p className="text-sm text-red-600">{results.error.message}</p>
      : (
        <div className="space-y-4">
          {results.data.total === 0 && <EmptyState title="No results" message={`Nothing matched "${submitted}".`} />}

          {results.data.tasks?.length > 0 && (
            <Card>
              <CardHeader title={`Tasks (${results.data.tasks.length})`} />
              <ul className="divide-y divide-slate-100">
                {results.data.tasks.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => navigate(`/tasks/${t.id}`)} className="w-full px-4 py-2.5 text-left hover:bg-slate-50">
                      <p className="truncate text-sm font-medium text-slate-800">{t.title}</p>
                      <p className="truncate text-xs text-slate-500">{t.status.replace(/_/g, ' ').toLowerCase()} · {t.dueDate ? formatBusiness(t.dueDate, 'dd MMM') : 'no due date'}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {results.data.people?.length > 0 && (
            <Card>
              <CardHeader title={`People (${results.data.people.length})`} />
              <ul className="divide-y divide-slate-100">
                {results.data.people.map((p) => (
                  <li key={p.id} className="px-4 py-2.5">
                    <p className="text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="truncate text-xs text-slate-500">{[p.designation, p.department, p.email].filter(Boolean).join(' · ') || '—'}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {results.data.followUps?.length > 0 && (
            <Card>
              <CardHeader title={`Follow-ups (${results.data.followUps.length})`} />
              <ul className="divide-y divide-slate-100">
                {results.data.followUps.map((f) => (
                  <li key={f.id}>
                    <button onClick={() => navigate(`/tasks/${f.task?.id}`)} className="w-full px-4 py-2.5 text-left hover:bg-slate-50">
                      <p className="truncate text-sm text-slate-700">{f.note}</p>
                      <p className="truncate text-xs text-slate-500">on "{f.task?.title}" · {formatBusiness(f.createdAt, 'dd MMM')}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
