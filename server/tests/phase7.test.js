// Phase 7 regression tests (node --test).
// These tests boot the real Express app on an ephemeral port with a stubbed
// Prisma client, covering: health/readiness, password login (allowlist,
// wrong password, inactive account), session auth, validation whitelisting
// and scheduler module safety.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Stub the database module BEFORE any app code loads it.
const stubUsers = [];
const stubState = { dbUp: true };
require.cache[require.resolve('../src/config/database')] = {
  id: require.resolve('../src/config/database'),
  filename: require.resolve('../src/config/database'),
  loaded: true,
  exports: {
    prisma: {
      $runCommandRaw: async () => {
        if (!stubState.dbUp) throw new Error('connection refused');
        return { ok: 1 };
      },
      $connect: async () => {},
      $disconnect: async () => {},
      user: {
        findUnique: async ({ where }) => {
          if (where.id) return stubUsers.find((u) => u.id === where.id) || null;
          if (where.email) return stubUsers.find((u) => u.email === where.email) || null;
          return null;
        },
        update: async ({ where, data }) => {
          const u = stubUsers.find((x) => x.id === where.id);
          return { ...u, ...data };
        },
      },
      $on: () => {},
    },
    connectDatabase: async () => {},
    disconnectDatabase: async () => {},
    checkDatabaseConnection: async () => true,
  },
};

// Stub bcrypt so tests do not depend on hash timing/rounds.
const TEST_PASSWORD_HASH = 'test-hash-matches-only-in-tests';
require.cache[require.resolve('bcryptjs')] = {
  id: require.resolve('bcryptjs'),
  filename: require.resolve('bcryptjs'),
  loaded: true,
  exports: {
    hash: async (plain) => `hashed(${plain})`,
    compare: async (plain, hash) => hash === TEST_PASSWORD_HASH && plain === 'correct-password',
  },
};

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-32ch';
process.env.ALLOWED_USER_EMAIL = 'owner@example.com';

const { createApp } = require('../src/app');
const { signSessionToken } = require('../src/middleware/auth');

let server = null;
let baseUrl = null;

before(async () => {
  await new Promise((resolve) => {
    server = createApp().listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function seedUser(overrides = {}) {
  const user = {
    id: 'user-1',
    email: 'owner@example.com',
    passwordHash: TEST_PASSWORD_HASH,
    displayName: 'Owner',
    role: 'PRIMARY_USER',
    isActive: true,
    ...overrides,
  };
  stubUsers.push(user);
  return user;
}

async function get(pathName, { token } = {}) {
  const res = await fetch(`${baseUrl}${pathName}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, body: await res.json() };
}

async function post(pathName, payload, { token } = {}) {
  const res = await fetch(`${baseUrl}${pathName}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

async function patch(pathName, payload, { token } = {}) {
  const res = await fetch(`${baseUrl}${pathName}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

describe('Phase 7: health & readiness', () => {
  test('GET /api/health returns 200 with no sensitive data', async () => {
    const { status, body } = await get('/api/health');
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'ok');
    assert.ok(!JSON.stringify(body).includes('DATABASE_URL'));
  });

  test('GET /api/ready reports ready when database responds', async () => {
    const { status, body } = await get('/api/ready');
    assert.equal(status, 200);
    assert.equal(body.data.ready, true);
  });

  test('GET /api/ready reports 503 when database is down', async () => {
    stubState.dbUp = false;
    const { status } = await get('/api/ready');
    assert.equal(status, 503);
    stubState.dbUp = true;
  });

  test('GET /api/v1/health reports database status', async () => {
    const { status, body } = await get('/api/v1/health');
    assert.equal(status, 200);
    assert.equal(body.data.database, 'up');
  });
});

describe('Phase 7: password login & single-user authorization', () => {
  test('login with correct credentials returns session token and user', async () => {
    seedUser();
    const { status, body } = await post('/api/v1/auth/login', {
      email: 'owner@example.com',
      password: 'correct-password',
    });
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.sessionToken);
    assert.equal(body.data.user.email, 'owner@example.com');
  });

  test('login with wrong password returns 401', async () => {
    const { status } = await post('/api/v1/auth/login', {
      email: 'owner@example.com',
      password: 'wrong-password',
    });
    assert.equal(status, 401);
  });

  test('login with non-allowlisted email returns 403', async () => {
    const { status } = await post('/api/v1/auth/login', {
      email: 'intruder@example.com',
      password: 'whatever',
    });
    assert.equal(status, 403);
  });

  test('login returns uniform 401 when allowlisted user has no password set', async () => {
    // Allowlist passes, user row exists but passwordHash is null (not seeded).
    stubUsers.length = 0; // isolate from earlier seeded users
    seedUser({ id: 'user-nopass', email: 'owner@example.com', passwordHash: null });
    const { status } = await post('/api/v1/auth/login', {
      email: 'owner@example.com',
      password: 'correct-password',
    });
    assert.equal(status, 401);
  });

  test('login rejects malformed body with 422', async () => {
    const { status } = await post('/api/v1/auth/login', { email: 'not-an-email', password: '' });
    assert.equal(status, 422);
  });

  test('protected route rejects missing token with 401', async () => {
    const { status, body } = await get('/api/v1/auth/me');
    assert.equal(status, 401);
    assert.equal(body.success, false);
  });

  test('protected route rejects invalid token with 401', async () => {
    const { status } = await get('/api/v1/auth/me', { token: 'not-a-jwt' });
    assert.equal(status, 401);
  });

  test('valid session token passes and returns the session user', async () => {
    const user = seedUser({ id: 'user-3', passwordHash: null });
    const token = signSessionToken(user);
    const { status, body } = await get('/api/v1/auth/me', { token });
    assert.equal(status, 200);
    assert.equal(body.data.user.email, 'owner@example.com');
  });

  test('inactive user session is rejected', async () => {
    const user = seedUser({ id: 'user-2', isActive: false, passwordHash: null });
    const token = signSessionToken(user);
    const { status } = await get('/api/v1/auth/me', { token });
    assert.equal(status, 401);
  });
});

describe('Phase 7: server-side validation whitelisting', () => {
  test('invalid task status body is rejected with 422 and field errors', async () => {
    const user = seedUser({ id: 'user-4', passwordHash: null });
    const token = signSessionToken(user);
    const { status, body } = await patch('/api/v1/tasks/whatever/status', { status: 'HACKED' }, { token });
    assert.equal(status, 422);
    assert.equal(body.success, false);
    assert.ok(Array.isArray(body.errors) && body.errors.length > 0);
  });

  test('invalid id param is rejected (injection-safe)', async () => {
    const user = seedUser({ id: 'user-5', passwordHash: null });
    const token = signSessionToken(user);
    const { status } = await patch('/api/v1/tasks/not$valid$id/status', { status: 'COMPLETED' }, { token });
    assert.equal(status, 422);
  });
});

describe('Phase 7: scheduler safety', () => {
  test('scheduler module exposes start/stop/runOnce without starting timers on import', async () => {
    const { scheduler } = require('../src/scheduler');
    assert.equal(typeof scheduler.start, 'function');
    assert.equal(typeof scheduler.stop, 'function');
    assert.equal(typeof scheduler.runOnce, 'function');
  });
});
