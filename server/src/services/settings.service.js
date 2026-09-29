// User settings service.

const { prisma } = require('../config/database');
const { ValidationError } = require('../utils/errors');

const settingsService = {
  async getSettings(userId) {
    let settings = await prisma.userSetting.findUnique({ where: { userId } });
    if (!settings) settings = await prisma.userSetting.create({ data: { userId } });
    return settings;
  },

  async updateSettings(userId, patch) {
    const clean = {};
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

    if (patch.timezone !== undefined) {
      if (typeof patch.timezone !== 'string' || patch.timezone.length > 60) throw new ValidationError('Invalid timezone');
      clean.timezone = patch.timezone;
    }
    if (patch.briefingTime !== undefined) {
      if (typeof patch.briefingTime !== 'string' || !timeRe.test(patch.briefingTime)) {
        throw new ValidationError('Briefing time must be HH:mm');
      }
      clean.briefingTime = patch.briefingTime;
    }
    if (patch.briefingEnabled !== undefined) clean.briefingEnabled = Boolean(patch.briefingEnabled);
    if (patch.defaultTaskLeadHours !== undefined) {
      const v = Number(patch.defaultTaskLeadHours);
      if (!Number.isInteger(v) || v < 0 || v > 168) throw new ValidationError('Task lead hours must be 0-168');
      clean.defaultTaskLeadHours = v;
    }
    if (patch.defaultFollowUpLeadHours !== undefined) {
      const v = Number(patch.defaultFollowUpLeadHours);
      if (!Number.isInteger(v) || v < 0 || v > 168) throw new ValidationError('Follow-up lead hours must be 0-168');
      clean.defaultFollowUpLeadHours = v;
    }
    if (patch.defaultMeetingLeadMinutes !== undefined) {
      const v = Number(patch.defaultMeetingLeadMinutes);
      if (!Number.isInteger(v) || v < 0 || v > 1440) throw new ValidationError('Meeting lead minutes must be 0-1440');
      clean.defaultMeetingLeadMinutes = v;
    }
    if (patch.browserNotificationsEnabled !== undefined) clean.browserNotificationsEnabled = Boolean(patch.browserNotificationsEnabled);
    if (patch.voiceEnabled !== undefined) clean.voiceEnabled = Boolean(patch.voiceEnabled);
    if (patch.speechRate !== undefined) {
      const v = Number(patch.speechRate);
      if (Number.isNaN(v) || v < 0.5 || v > 2) throw new ValidationError('Speech rate must be 0.5-2');
      clean.speechRate = v;
    }
    if (patch.speechPitch !== undefined) {
      const v = Number(patch.speechPitch);
      if (Number.isNaN(v) || v < 0.5 || v > 2) throw new ValidationError('Speech pitch must be 0.5-2');
      clean.speechPitch = v;
    }

    await settingsService.getSettings(userId);
    return prisma.userSetting.update({ where: { userId }, data: clean });
  },
};

module.exports = { settingsService };
