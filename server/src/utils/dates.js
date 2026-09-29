// Date/time helpers centralized around the business timezone (Asia/Kolkata).
// All machine timestamps are stored as UTC Date objects; these helpers convert
// to/from the business timezone for "today/this week/overdue" rules.

// date-fns-tz v3 renamed these helpers: utcToZonedTime -> toZonedTime,
// zonedTimeToUtc -> fromZonedTime (same signatures).
const { fromZonedTime, toZonedTime, formatInTimeZone } = require('date-fns-tz');
const { BUSINESS_TIMEZONE } = require('../constants');

function startOfBusinessDay(date = new Date()) {
  const zoned = toZonedTime(date, BUSINESS_TIMEZONE);
  zoned.setHours(0, 0, 0, 0);
  return fromZonedTime(zoned, BUSINESS_TIMEZONE);
}

function endOfBusinessDay(date = new Date()) {
  const zoned = toZonedTime(date, BUSINESS_TIMEZONE);
  zoned.setHours(23, 59, 59, 999);
  return fromZonedTime(zoned, BUSINESS_TIMEZONE);
}

function addBusinessDaysUTC(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function startOfBusinessWeek(date = new Date()) {
  const zoned = toZonedTime(date, BUSINESS_TIMEZONE);
  const day = zoned.getDay(); // 0 Sunday
  zoned.setDate(zoned.getDate() - day);
  zoned.setHours(0, 0, 0, 0);
  return fromZonedTime(zoned, BUSINESS_TIMEZONE);
}

function endOfBusinessWeek(date = new Date()) {
  const start = startOfBusinessWeek(date);
  const end = addBusinessDaysUTC(start, 7);
  return new Date(end.getTime() - 1);
}

function startOfBusinessMonth(date = new Date()) {
  const zoned = toZonedTime(date, BUSINESS_TIMEZONE);
  zoned.setDate(1);
  zoned.setHours(0, 0, 0, 0);
  return fromZonedTime(zoned, BUSINESS_TIMEZONE);
}

function endOfBusinessMonth(date = new Date()) {
  const zoned = toZonedTime(date, BUSINESS_TIMEZONE);
  const month = zoned.getMonth();
  zoned.setMonth(month + 1, 0);
  zoned.setHours(23, 59, 59, 999);
  return fromZonedTime(zoned, BUSINESS_TIMEZONE);
}

// A task is overdue when it has a due date in the past (business timezone)
// and is not COMPLETED or CANCELLED.
function isOverdue(task, now = new Date()) {
  if (!task.dueDate) return false;
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
  return new Date(task.dueDate).getTime() < endOfBusinessDay(now).getTime()
    && new Date(task.dueDate).getTime() < now.getTime();
}

// Day-key (YYYY-MM-DD) in business timezone - used for "today" comparisons.
function businessDayKey(date = new Date()) {
  return formatInTimeZone(date, BUSINESS_TIMEZONE, 'yyyy-MM-dd');
}

function formatBusiness(date, pattern = 'dd MMM yyyy, h:mm a') {
  return formatInTimeZone(new Date(date), BUSINESS_TIMEZONE, pattern);
}

module.exports = {
  BUSINESS_TIMEZONE,
  startOfBusinessDay,
  endOfBusinessDay,
  addBusinessDaysUTC,
  startOfBusinessWeek,
  endOfBusinessWeek,
  startOfBusinessMonth,
  endOfBusinessMonth,
  isOverdue,
  businessDayKey,
  formatBusiness,
};
