// TaskDetailPage - full task information, status actions, follow-up timeline.

import { useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, CheckCircle2, RotateCcw, XCircle, Trash2, FileText } from 'lucide-react';
import { Card, CardHeader, Button, Loader, ErrorState, StatusBadge, PriorityBadge, ConfirmDialog, Select, EmptyState } from '../components/common';
import { TaskForm } from '../components/forms/TaskForm';
import { FollowUpForm } from '../components/forms/FollowUpForm';
import { taskService, taskAttachmentService } from '../services/domain.services';
import { useToast } from '../context/ToastContext';
import { formatBusiness, TASK_STATUS_OPTIONS } from '../utils/format';

function formatFileSize(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

export function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const taskQ = useQuery({ queryKey: ['task', id], queryFn: () => taskService.get(id) });
  const followUpsQ = useQuery({ queryKey: ['task-followups', id], queryFn: () => taskService.listFollowUps(id) });

  if (taskQ.isLoading) return <Loader label="Loading task…" />;
  if (taskQ.isError) return <ErrorState message={taskQ.error.message} onRetry={taskQ.refetch} />;

  const task = taskQ.data.task;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['task', id] });
    queryClient.invalidateQueries({ queryKey: ['task-followups', id] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  };

  const doStatus = async (status) => {
    setBusy(true);
    try {
      await taskService.changeStatus(id, status);
      showToast(`Status changed to ${status.replace(/_/g, ' ').toLowerCase()}`);
      refresh();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const handleRemoveAttachment = async (attachmentId) => {
    try {
      setBusy(true);
      await taskAttachmentService.remove(id, attachmentId);
      showToast('Attachment removed');
      refresh();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleFileInput = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = '';
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await taskAttachmentService.upload(id, files[i]);
      }
      showToast(`${files.length} file(s) attached`);
      refresh();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const statusButtons = [];
  if (['NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'ON_HOLD'].includes(task.status)) {
    statusButtons.push({ key: 'complete', label: 'Mark complete', icon: CheckCircle2, run: () => doStatus('COMPLETED'), classes: 'bg-emerald-600 text-white hover:bg-emerald-700' });
    statusButtons.push({ key: 'cancel', label: 'Cancel task', icon: XCircle, run: () => setConfirm({ action: () => doStatus('CANCELLED'), message: 'Cancel this task? It will no longer appear as active or overdue.' }) });
  }
  if (task.status === 'COMPLETED') {
    statusButtons.push({ key: 'reopen', label: 'Reopen task', icon: RotateCcw, run: () => doStatus('IN_PROGRESS') });
  }
  if (task.status === 'CANCELLED') {
    statusButtons.push({ key: 'reopen', label: 'Reopen task', icon: RotateCcw, run: () => doStatus('NOT_STARTED') });
  }

  const attachments = task.attachments || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <p className="text-sm text-slate-500">Task detail</p>
      </div>

      <Card>
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-900">{task.title}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{task.taskType}</span>
                {task.isOverdue && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">OVERDUE</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil size={14} /> Edit</Button>
              <Button variant="accent" onClick={() => setFollowUpOpen(true)}><Plus size={14} /> Follow-up</Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <Field label="Assignee">
            {task.assignee
              ? <Link to="/people" className="text-sm text-primary-700 hover:underline">{task.assignee.name}</Link>
              : <span className="text-sm text-slate-400">—</span>}
          </Field>
          <Field label="Created"><span className="text-sm text-slate-700">{formatBusiness(task.createdAt)}</span></Field>
          <Field label="Assigned date"><span className="text-sm text-slate-700">{formatBusiness(task.assignedDate, 'dd MMM yyyy') || '—'}</span></Field>
          <Field label="Start date"><span className="text-sm text-slate-700">{formatBusiness(task.startDate, 'dd MMM yyyy') || '—'}</span></Field>
          <Field label="Due date">
            <span className={`text-sm ${task.isOverdue ? 'font-semibold text-red-600' : 'text-slate-700'}`}>
              {task.dueDate ? formatBusiness(task.dueDate) : '—'}
            </span>
          </Field>
          <Field label="Completed"><span className="text-sm text-slate-700">{task.completedAt ? formatBusiness(task.completedAt) : '—'}</span></Field>
        </div>

        {task.description && (
          <div className="border-t border-slate-100 px-4 py-3">
            <p className="text-xs font-medium text-slate-500">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{task.description}</p>
          </div>
        )}

        <div className="border-t border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500">Attachments ({attachments.length})</p>
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} loading={uploading}>
              <Plus size={14} /> Attach
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.txt,.png,.jpg,.jpeg"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
          {attachments.length === 0 ? (
            <EmptyState title="No attachments" message="Attach screenshots or files using the button above." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {attachments.map((att) => (
                <div key={att.id} className="group relative">
                  <div
                    className={`overflow-hidden rounded-md border border-slate-200 bg-slate-50 ${att.mimeType?.startsWith('image/') ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (att.mimeType?.startsWith('image/')) {
                        window.open(att.url, '_blank');
                      }
                    }}
                  >
                    <div className="h-32 w-full">
                      {att.mimeType?.startsWith('image/') ? (
                        <img src={att.url} alt={att.filename} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <FileText size={32} className="text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-sm font-medium text-slate-800">{att.filename}</p>
                      <p className="text-[11px] text-slate-500">{formatFileSize(att.size || 0)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveAttachment(att.id);
                    }}
                    className="absolute right-1.5 top-1.5 hidden h-6 w-6 items-center justify-center rounded-md bg-white border border-slate-200 text-red-600 shadow-sm group-hover:flex disabled:opacity-50"
                    aria-label="Delete attachment"
                    disabled={busy}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {statusButtons.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
            {statusButtons.map((b) => (
              <button key={b.key} onClick={b.run} disabled={busy} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${b.classes || 'bg-primary-700 text-white hover:bg-primary-800'}`}>
                <b.icon size={14} /> {b.label}
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-slate-100 px-4 py-3">
          <div className="max-w-xs">
            <Select
              label="Change status"
              value={task.status}
              onChange={(e) => doStatus(e.target.value)}
              options={TASK_STATUS_OPTIONS}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Follow-up timeline" subtitle={`${followUpsQ.data?.followUps?.length || 0} entr(ies), oldest preserved first`} />
        {followUpsQ.isLoading ? <Loader />
        : !followUpsQ.data?.followUps?.length ? <p className="px-4 py-6 text-center text-sm text-slate-500">No follow-ups yet.</p>
        : (
          <ol className="space-y-0 px-4 py-3">
            {followUpsQ.data.followUps.map((f, idx) => (
              <li key={f.id} className="relative border-l-2 border-primary-100 pb-4 pl-4 last:pb-0">
                <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-primary-500" />
                <p className="text-xs text-slate-400">
                  {formatBusiness(f.followUpAt)}
                  {f.nextFollowUpAt ? ` · next: ${formatBusiness(f.nextFollowUpAt)}` : ''}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{f.note}</p>
                {idx === followUpsQ.data.followUps.length - 1 && (
                  <span className="mt-1 inline-block rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-700">latest</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <TaskForm open={editOpen} onClose={() => setEditOpen(false)} task={task} onSaved={refresh} />
      <FollowUpForm open={followUpOpen} onClose={() => setFollowUpOpen(false)} taskId={id} />
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.action}
        title="Please confirm"
        message={confirm?.message}
        loading={busy}
      />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
