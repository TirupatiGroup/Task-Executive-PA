// Person service - business rules for the People directory.

const { personRepository } = require('../repositories/person.repository');
const { activityRepository } = require('../repositories/activity.repository');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors');

const MAX_LEN = { name: 120, designation: 120, department: 120, email: 200, phone: 30 };

function validatePersonInput(data, { partial = false } = {}) {
  const errors = [];
  const clean = {};

  if (!partial || data.name !== undefined) {
    if (typeof data.name !== 'string' || !data.name.trim()) {
      errors.push({ field: 'name', message: 'Name is required' });
    } else if (data.name.trim().length > MAX_LEN.name) {
      errors.push({ field: 'name', message: `Name must be at most ${MAX_LEN.name} characters` });
    } else {
      clean.name = data.name.trim();
    }
  }
  for (const field of ['designation', 'department']) {
    if (data[field] !== undefined) {
      if (data[field] === null || data[field] === '') { clean[field] = null; continue; }
      if (typeof data[field] !== 'string' || data[field].length > MAX_LEN[field]) {
        errors.push({ field, message: `Invalid ${field}` });
      } else clean[field] = data[field].trim();
    }
  }
  if (data.email !== undefined) {
    if (data.email === null || data.email === '') { clean.email = null; }
    else if (typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > MAX_LEN.email) {
      errors.push({ field: 'email', message: 'Invalid email format' });
    } else clean.email = data.email.trim().toLowerCase();
  }
  if (data.phone !== undefined) {
    if (data.phone === null || data.phone === '') { clean.phone = null; }
    else if (typeof data.phone !== 'string' || data.phone.length > MAX_LEN.phone) {
      errors.push({ field: 'phone', message: 'Invalid phone' });
    } else clean.phone = data.phone.trim();
  }
  if (data.isActive !== undefined) clean.isActive = Boolean(data.isActive);

  if (errors.length) throw new ValidationError('Person validation failed', errors);
  return clean;
}

const personService = {
  validatePersonInput,

  async listPeople({ isActive, search, page = 1, limit = 50 }) {
    const where = {};
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;
    if (search && typeof search === 'string' && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }
    const [people, total] = await Promise.all([
      personRepository.findMany({ where, skip: (page - 1) * limit, take: limit }),
      personRepository.count(where),
    ]);
    return { people, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },

  async getPerson(id) {
    const person = await personRepository.findById(id);
    if (!person) throw new NotFoundError('Person not found');
    const activeTasks = await personRepository.countActiveTasks(id);
    return { person, activeTasks };
  },

  async createPerson(data, userId) {
    const clean = personService.validatePersonInput(data);
    const person = await personRepository.create({ ...clean, createdById: userId });
    await activityRepository.create({
      entityType: 'PERSON',
      entityId: person.id,
      action: 'CREATE',
      summary: `Created person "${person.name}"`,
      createdById: userId,
    });
    return person;
  },

  async updatePerson(id, data, userId) {
    const existing = await personRepository.findById(id);
    if (!existing) throw new NotFoundError('Person not found');
    const clean = personService.validatePersonInput(data, { partial: true });
    const person = await personRepository.update(id, clean);
    await activityRepository.create({
      entityType: 'PERSON',
      entityId: id,
      action: 'UPDATE',
      summary: `Updated person "${person.name}"`,
      createdById: userId,
    });
    return person;
  },

  async setPersonStatus(id, isActive, userId) {
    const existing = await personRepository.findById(id);
    if (!existing) throw new NotFoundError('Person not found');
    if (existing.isActive && !isActive) {
      const activeTasks = await personRepository.countActiveTasks(id);
      if (activeTasks > 0) {
        throw new ConflictError(`Person has ${activeTasks} active task(s). Reassign before deactivating.`);
      }
    }
    const person = await personRepository.update(id, { isActive });
    await activityRepository.create({
      entityType: 'PERSON',
      entityId: id,
      action: isActive ? 'RESTORE' : 'ARCHIVE',
      summary: `${isActive ? 'Activated' : 'Deactivated'} person "${person.name}"`,
      createdById: userId,
    });
    return person;
  },
};

module.exports = { personService };
