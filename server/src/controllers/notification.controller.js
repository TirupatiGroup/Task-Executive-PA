// Notification, reminder-settings and reminder controllers.

const { asyncHandler, success } = require('../utils/response');
const { notificationService } = require('../services/notification.service');
const { settingsService } = require('../services/settings.service');
const { scheduler } = require('../scheduler');

const listNotifications = asyncHandler(async (req, res) => {
  const data = await notificationService.listNotifications(req.user.id, {
    type: req.query.type,
    isRead: req.query.isRead,
    page: parseInt(req.query.page || '1', 10),
    limit: Math.min(parseInt(req.query.limit || '20', 10), 100),
  });
  return success(res, { message: 'Notifications', data });
});

const setNotificationRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.setRead(req.user.id, req.params.id, Boolean(req.body.isRead));
  return success(res, { message: 'Notification updated', data: { notification } });
});

const markAllRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAllRead(req.user.id);
  return success(res, { message: 'All notifications marked read', data });
});

const getReminderSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings(req.user.id);
  return success(res, { message: 'Reminder settings', data: { settings } });
});

const updateReminderSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(req.user.id, req.body);
  return success(res, { message: 'Reminder settings updated', data: { settings } });
});

const snoozeReminder = asyncHandler(async (req, res) => {
  const reminder = await notificationService.snoozeReminder(req.user.id, req.params.id, req.body.snoozedUntil);
  return success(res, { message: 'Reminder snoozed', data: { reminder } });
});

const runScheduler = asyncHandler(async (req, res) => {
  const results = await scheduler.runOnce();
  return success(res, { message: 'Scheduler executed', data: { results } });
});

module.exports = { listNotifications, setNotificationRead, markAllRead, getReminderSettings, updateReminderSettings, snoozeReminder, runScheduler };
