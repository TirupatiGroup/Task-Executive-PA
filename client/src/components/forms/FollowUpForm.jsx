// FollowUpForm - add a chronological follow-up entry.

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, Input, Textarea, Modal } from '../common';
import { taskService } from '../../services/domain.services';
import { useToast } from '../../context/ToastContext';
import { useQueryClient } from '@tanstack/react-query';
import { toLocalInputValue } from '../../utils/format';

export function FollowUpForm({ open, onClose, taskId }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { note: '', followUpAt: '', nextFollowUpAt: '' },
  });

  useEffect(() => {
    if (open) {
      reset({ note: '', followUpAt: toLocalInputValue(new Date()), nextFollowUpAt: '' });
    }
  }, [open, reset]);

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      await taskService.addFollowUp(taskId, {
        note: values.note,
        followUpAt: values.followUpAt ? new Date(values.followUpAt).toISOString() : undefined,
        nextFollowUpAt: values.nextFollowUpAt ? new Date(values.nextFollowUpAt).toISOString() : null,
      });
      showToast('Follow-up added');
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Follow-up">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Input label="Follow-up date/time" type="datetime-local" {...register('followUpAt')} />
        <Textarea label="Note *" placeholder="What happened / what was discussed?" error={errors.note?.message} {...register('note', { required: 'Note is required' })} />
        <Input label="Next follow-up (optional)" type="datetime-local" {...register('nextFollowUpAt')} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving}>Add follow-up</Button>
        </div>
      </form>
    </Modal>
  );
}
