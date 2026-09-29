// PersonForm - add/edit people in the directory.

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Modal } from '../common';
import { peopleService } from '../../services/domain.services';
import { useToast } from '../../context/ToastContext';
import { useQueryClient } from '@tanstack/react-query';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  designation: z.string().max(120).optional().or(z.literal('')),
  department: z.string().max(120).optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
});

export function PersonForm({ open, onClose, person = null }) {
  const isEdit = Boolean(person?.id);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', designation: '', department: '', email: '', phone: '' },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: person?.name || '',
        designation: person?.designation || '',
        department: person?.department || '',
        email: person?.email || '',
        phone: person?.phone || '',
      });
    }
  }, [open, person, reset]);

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      const body = {
        name: values.name,
        designation: values.designation || null,
        department: values.department || null,
        email: values.email || null,
        phone: values.phone || null,
      };
      if (isEdit) {
        await peopleService.update(person.id, body);
        showToast('Person updated');
      } else {
        await peopleService.create(body);
        showToast('Person added');
      }
      queryClient.invalidateQueries({ queryKey: ['people'] });
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Person' : 'Add Person'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Input label="Name *" error={errors.name?.message} {...register('name')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Designation" error={errors.designation?.message} {...register('designation')} />
          <Input label="Department" error={errors.department?.message} {...register('department')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Phone" error={errors.phone?.message} {...register('phone')} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving}>{isEdit ? 'Save changes' : 'Add person'}</Button>
        </div>
      </form>
    </Modal>
  );
}
