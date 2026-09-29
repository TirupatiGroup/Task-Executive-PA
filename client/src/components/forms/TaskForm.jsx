// TaskForm - create/edit tasks with conditional assignee (RHF + Zod).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Textarea, Select, Modal } from '../common';
import { peopleService, taskService, taskAttachmentService } from '../../services/domain.services';
import { useToast } from '../../context/ToastContext';
import { TASK_PRIORITY_OPTIONS, TASK_TYPE_OPTIONS, toLocalInputValue } from '../../utils/format';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Paperclip, FileText, X, Loader2 } from 'lucide-react';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
  taskType: z.enum(['PERSONAL', 'ASSIGNED']),
  assigneeId: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.taskType === 'ASSIGNED' && !data.assigneeId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['assigneeId'], message: 'Assignee is required for assigned tasks' });
  }
});

function formatFileSize(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function TaskForm({ open, onClose, task = null, onSaved }) {
  const isEdit = Boolean(task?.id);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const fileInputRef = useRef(null);

  const people = useQuery({ queryKey: ['people', 'active'], queryFn: () => peopleService.list({ isActive: 'true', limit: 100 }) });

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      taskType: 'PERSONAL',
      assigneeId: '',
      priority: 'NORMAL',
      startDate: '',
      dueDate: '',
    },
  });

  const taskType = watch('taskType');

  useEffect(() => {
    if (open) {
      reset({
        title: task?.title || '',
        description: task?.description || '',
        taskType: task?.taskType || 'PERSONAL',
        assigneeId: task?.assigneeId || '',
        priority: task?.priority || 'NORMAL',
        startDate: toLocalInputValue(task?.startDate),
        dueDate: toLocalInputValue(task?.dueDate),
      });
      setPendingFiles([]);
    }
  }, [open, task, reset]);

  useEffect(() => {
    if (!open) return;
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        addPendingFiles(files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open]);

  const addPendingFiles = (files) => {
    const newPending = Array.from(files).map((file) => {
      const pf = { id: generateId(), file };
      if (file.type.startsWith('image/')) {
        pf.previewDataUrl = URL.createObjectURL(file);
      }
      return pf;
    });
    setPendingFiles((prev) => [...prev, ...newPending]);
  };

  const removePendingFile = (id) => {
    setPendingFiles((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewDataUrl) {
        URL.revokeObjectURL(target.previewDataUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const captureScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];

      const finishCapture = (blob) => {
        track.stop();
        stream.getTracks().forEach((t) => t.stop());
        if (!blob) {
          showToast('Screenshot capture failed', 'error');
          return;
        }
        const ts = Date.now();
        const file = new File([blob], `screenshot-${ts}.png`, { type: 'image/png' });
        addPendingFiles([file]);
      };

      if (typeof ImageCapture !== 'undefined') {
        try {
          const capture = new ImageCapture(track);
          const bitmap = await capture.grabFrame();
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          canvas.getContext('2d').drawImage(bitmap, 0, 0);
          canvas.toBlob(finishCapture, 'image/png');
          return;
        } catch (_e) {
          // fall through to video method
        }
      }

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      await new Promise((r) => setTimeout(r, 150));
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.toBlob(finishCapture, 'image/png');
      video.pause();
      video.srcObject = null;
    } catch (err) {
      showToast(err.message || 'Screenshot permissions denied', 'error');
    }
  };

  const onFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      addPendingFiles(files);
    }
    e.target.value = '';
  };

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      const body = {
        title: values.title,
        description: values.description || null,
        taskType: values.taskType,
        assigneeId: values.taskType === 'ASSIGNED' ? values.assigneeId : null,
        priority: values.priority,
        startDate: values.startDate ? new Date(values.startDate).toISOString() : null,
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : null,
      };

      let savedTaskId;
      let createdResult;

      if (isEdit) {
        await taskService.update(task.id, body);
        savedTaskId = task.id;
      } else {
        createdResult = await taskService.create(body);
        savedTaskId = createdResult?.task?.id || createdResult?.id;
      }

      if (pendingFiles.length > 0 && savedTaskId) {
        for (let i = 0; i < pendingFiles.length; i++) {
          const pf = pendingFiles[i];
          setPendingFiles((prev) =>
            prev.map((p) => (p.id === pf.id ? { ...p, uploading: true, error: undefined } : p))
          );
          try {
            await taskAttachmentService.upload(savedTaskId, pf.file);
            setPendingFiles((prev) => prev.filter((p) => p.id !== pf.id));
          } catch (err) {
            setPendingFiles((prev) =>
              prev.map((p) => (p.id === pf.id ? { ...p, uploading: false, error: err.message } : p))
            );
            showToast(`Failed to upload ${pf.file.name}: ${err.message}`, 'error');
            setSaving(false);
            return;
          }
        }
      }

      showToast(isEdit ? 'Task updated' : 'Task created');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['task', task?.id] });
      queryClient.invalidateQueries({ queryKey: ['task', savedTaskId] });
      onSaved?.();
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const peopleOptions = useMemo(() => {
    const list = people.data?.people || [];
    return [{ value: '', label: taskType === 'ASSIGNED' ? 'Select assignee…' : '—' }, ...list.map((p) => ({ value: p.id, label: p.name }))];
  }, [people.data, taskType]);

  const existingAttachments = task?.attachments || [];

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Task' : 'New Task'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Input label="Title *" placeholder="What needs to be done?" error={errors.title?.message} {...register('title')} />
        <Textarea label="Description" placeholder="Optional details…" error={errors.description?.message} {...register('description')} />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Type" options={TASK_TYPE_OPTIONS} error={errors.taskType?.message} {...register('taskType')} />
          <Select label="Priority" options={TASK_PRIORITY_OPTIONS} error={errors.priority?.message} {...register('priority')} />
        </div>

        {taskType === 'ASSIGNED' && (
          <div>
            <Select label="Assignee *" options={peopleOptions} error={errors.assigneeId?.message} {...register('assigneeId')} />
            {(people.data?.people || []).length === 0 && (
              <p className="mt-1 text-xs text-amber-600">No people added yet — add one on the People page first, or switch Type to Personal.</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Start date" type="datetime-local" {...register('startDate')} />
          <Input label="Due date" type="datetime-local" error={errors.dueDate?.message} {...register('dueDate')} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">Screenshots / Files</p>

          {isEdit && existingAttachments.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-500">Attached</p>
              <div className="flex flex-wrap gap-2">
                {existingAttachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                    {att.mimeType?.startsWith('image/') ? (
                      <img src={att.url} alt={att.filename} className="h-8 w-8 rounded object-cover" />
                    ) : (
                      <FileText size={14} className="text-slate-500" />
                    )}
                    <span className="max-w-[120px] truncate text-xs text-slate-700">{att.filename}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={captureScreenshot}>
              <Camera size={14} /> Attach screenshot
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={14} /> Choose file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.txt,.png,.jpg,.jpeg"
              multiple
              onChange={onFileInputChange}
              className="hidden"
            />
            <span className="text-[11px] text-slate-400 self-center">Tip: press Ctrl+V to paste</span>
          </div>

          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {pendingFiles.map((pf) => (
                <div key={pf.id} className="relative w-24 rounded-md border border-slate-200 bg-white p-1.5">
                  <div className="relative h-24 w-full overflow-hidden rounded">
                    {pf.previewDataUrl ? (
                      <img src={pf.previewDataUrl} alt={pf.file.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-50">
                        <FileText size={24} className="text-slate-400" />
                      </div>
                    )}
                    {pf.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded">
                        <Loader2 size={18} className="animate-spin text-primary-600" />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removePendingFile(pf.id)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 shadow-sm hover:text-red-600"
                    aria-label="Remove file"
                  >
                    <X size={12} />
                  </button>
                  <p className="mt-1 truncate text-[10px] font-medium text-slate-700">{pf.file.name}</p>
                  <p className="text-[10px] text-slate-400">{formatFileSize(pf.file.size)}</p>
                  {pf.uploading && <p className="text-[10px] text-primary-600">Uploading…</p>}
                  {pf.error && <p className="text-[10px] text-red-600">{pf.error}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving}>{isEdit ? 'Save changes' : 'Create task'}</Button>
        </div>
      </form>
    </Modal>
  );
}
