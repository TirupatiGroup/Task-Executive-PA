// Client-side formatting helpers - Asia/Kolkata user-facing display.

import { formatInTimeZone } from 'date-fns-tz';

const TZ = 'Asia/Kolkata';

export function formatBusiness(date, pattern = 'dd MMM yyyy, h:mm a') {
  if (!date) return '--';
  try {
    return formatInTimeZone(new Date(date), TZ, pattern);
  } catch {
    return '--';
  }
}

export function toLocalInputValue(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const TASK_STATUS_OPTIONS = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const TASK_PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

export const TASK_TYPE_OPTIONS = [
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'ASSIGNED', label: 'Assigned' },
];
