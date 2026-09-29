// Reusable common UI components (single source of truth - no one-off copies).

import { forwardRef } from 'react';
import { Loader2, AlertCircle, Inbox, X } from 'lucide-react';

// ---------- Button ----------
const BUTTON_VARIANTS = {
  primary: 'bg-primary-700 text-white hover:bg-primary-800 focus:ring-primary-500',
  accent: 'bg-accent-500 text-white hover:bg-accent-600 focus:ring-accent-400',
  secondary: 'bg-white text-primary-800 border border-primary-200 hover:bg-primary-50 focus:ring-primary-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-400',
  ghost: 'text-primary-800 hover:bg-primary-50 focus:ring-primary-300',
};

const BUTTON_SIZES = {
  xs: 'px-2 py-1 text-[11px] rounded-md',
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-5 py-2.5 text-base rounded-lg',
};

export function Button({ variant = 'primary', size = 'md', className = '', loading = false, children, disabled, ...props }) {
  const sz = BUTTON_SIZES[size] || BUTTON_SIZES.md;
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${sz} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={size === 'xs' || size === 'sm' ? 13 : 16} className="animate-spin" />}
      {children}
    </button>
  );
}

// ---------- Card ----------
export function Card({ className = '', children }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------- Inputs ----------
export const Input = forwardRef(function Input({ label, error, className = '', ...props }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>}
      <input
        ref={ref}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:bg-slate-50 ${error ? 'border-red-400' : 'border-slate-300'} ${className}`}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, className = '', ...props }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>}
      <textarea
        ref={ref}
        rows={3}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 ${error ? 'border-red-400' : 'border-slate-300'} ${className}`}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
});

// forwardRef is REQUIRED: forms use react-hook-form's register(), which passes
// a ref through the spread. A plain function component drops it, so RHF reads
// undefined values on submit ("Required" errors even after selecting an option).
export const Select = forwardRef(function Select({ label, error, options = [], className = '', ...props }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>}
      <select
        ref={ref}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 ${error ? 'border-red-400' : 'border-slate-300'} ${className}`}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
});

// ---------- Modal / ConfirmDialog ----------
export function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmLabel = 'Confirm', loading = false }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      )}
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}

// ---------- Badges ----------
const STATUS_COLORS = {
  NOT_STARTED: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  WAITING: 'bg-amber-100 text-amber-800',
  ON_HOLD: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-slate-200 text-slate-500',
};

const PRIORITY_COLORS = {
  LOW: 'bg-slate-100 text-slate-600',
  NORMAL: 'bg-blue-50 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
      {(status || '').replace(/_/g, ' ')}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[priority] || 'bg-slate-100 text-slate-600'}`}>
      {priority}
    </span>
  );
}

// ---------- States ----------
export function Loader({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <Loader2 className="animate-spin" size={18} /> {label}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', message, action }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Inbox className="text-slate-300" size={32} />
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {message && <p className="max-w-sm text-xs text-slate-500">{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <AlertCircle className="text-red-300" size={32} />
      <p className="text-sm font-medium text-slate-700">{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

// ---------- Toast ----------
export function Toast({ toast }) {
  if (!toast) return null;
  const styles = toast.type === 'error'
    ? 'bg-red-600 text-white'
    : toast.type === 'success'
      ? 'bg-emerald-600 text-white'
      : 'bg-slate-800 text-white';
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2">
      <div className={`rounded-lg px-4 py-2 text-sm shadow-lg ${styles}`}>{toast.message}</div>
    </div>
  );
}
