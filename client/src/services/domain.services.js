// Domain service modules - one place per resource; pages never call axios directly.

import { api, apiCall } from './api';

const unwrap = (p) => apiCall(p);

export const taskService = {
  list: (params) => unwrap(api.get('/tasks', { params })),
  get: (id) => unwrap(api.get(`/tasks/${id}`)),
  create: (body) => unwrap(api.post('/tasks', body)),
  update: (id, body) => unwrap(api.patch(`/tasks/${id}`, body)),
  changeStatus: (id, status) => unwrap(api.patch(`/tasks/${id}/status`, { status })),
  addFollowUp: (id, body) => unwrap(api.post(`/tasks/${id}/followups`, body)),
  listFollowUps: (id) => unwrap(api.get(`/tasks/${id}/followups`)),
};

export const peopleService = {
  list: (params) => unwrap(api.get('/people', { params })),
  get: (id) => unwrap(api.get(`/people/${id}`)),
  create: (body) => unwrap(api.post('/people', body)),
  update: (id, body) => unwrap(api.patch(`/people/${id}`, body)),
  setStatus: (id, isActive) => unwrap(api.patch(`/people/${id}/status`, { isActive })),
};

export const dashboardService = {
  summary: () => unwrap(api.get('/dashboard/summary')),
  workQueue: (limit = 25) => unwrap(api.get('/dashboard/work-queue', { params: { limit } })),
  deadlineBoard: () => unwrap(api.get('/dashboard/deadline-board')),
  followUpBoard: () => unwrap(api.get('/dashboard/followup-board')),
};

export const searchService = {
  query: (q, limit = 10) => unwrap(api.get('/search', { params: { q, limit } })),
};

export const activityService = {
  list: (params) => unwrap(api.get('/activity', { params })),
};

export const calendarService = {
  status: () => unwrap(api.get('/calendar/status')),
  calendars: () => unwrap(api.get('/calendar/calendars')),
  saveConnection: (body) => unwrap(api.post('/calendar/connection', body)),
  updateConnection: (body) => unwrap(api.patch('/calendar/connection', body)),
  events: (params) => unwrap(api.get('/calendar/events', { params })),
  refresh: (body) => unwrap(api.post('/calendar/refresh', body || {})),
};

export const notificationService = {
  list: (params) => unwrap(api.get('/notifications', { params })),
  setRead: (id, isRead) => unwrap(api.patch(`/notifications/${id}/read`, { isRead })),
  markAllRead: () => unwrap(api.post('/notifications/read-all')),
  settings: () => unwrap(api.get('/reminder-settings')),
  updateSettings: (body) => unwrap(api.patch('/reminder-settings', body)),
  snooze: (id, snoozedUntil) => unwrap(api.post(`/reminders/${id}/snooze`, { snoozedUntil })),
  runScheduler: () => unwrap(api.post('/reminders/run-scheduler')),
};

export const briefingService = {
  today: () => unwrap(api.get('/briefing/today')),
};

export const assistantService = {
  capabilities: () => unwrap(api.get('/assistant/capabilities')),
  query: (text) => unwrap(api.post('/assistant/query', { text })),
  prepareAction: (action, taskId) => unwrap(api.post('/assistant/action/prepare', { action, taskId })),
  executeAction: (action, taskId, confirmToken) => unwrap(api.post('/assistant/action', { action, taskId, confirmToken })),
};

export const taskAttachmentService = {
  upload: (taskId, file) => {
    const form = new FormData();
    form.append('file', file);
    return apiCall(api.post(`/tasks/${taskId}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' } }));
  },
  list: (taskId) => unwrap(api.get(`/tasks/${taskId}/attachments`)),
  remove: (taskId, attachmentId) => unwrap(api.delete(`/tasks/${taskId}/attachments/${attachmentId}`)),
};
