// Seed: creates the primary user with a bcrypt-hashed password.
// NOTE: Replaced prisma.user.upsert() with manual check-then-create-or-update
// pattern so it works on standalone MongoDB (Prisma upsert() requires a
// replica set for transactions).
// Usage: PRIMARY_USER_PASSWORD='...' npm run db:seed  (falls back to a dev
// default 'ChangeMe123!' when unset - change it immediately in any shared env).

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function upsertUserByEmail(email, data) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return prisma.user.update({ where: { email }, data });
  }
  return prisma.user.create({ data: { email, ...data } });
}

async function upsertUserSettingByUserId(userId, data = {}) {
  const existing = await prisma.userSetting.findUnique({ where: { userId } });
  if (existing) {
    return prisma.userSetting.update({ where: { userId }, data });
  }
  return prisma.userSetting.create({ data: { userId, ...data } });
}

async function main() {
  const email = process.env.ALLOWED_USER_EMAIL;
  if (!email) {
    console.log('ALLOWED_USER_EMAIL not set; skipping primary-user seed.');
    return;
  }
  const password = process.env.PRIMARY_USER_PASSWORD || 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await upsertUserByEmail(email, {
    passwordHash,
    displayName: 'Primary User',
    role: 'PRIMARY_USER',
  });

  await upsertUserSettingByUserId(user.id);

  console.log(`Primary user ready: ${user.email}`);
  console.log(`Password: ${process.env.PRIMARY_USER_PASSWORD ? '(from PRIMARY_USER_PASSWORD)' : 'ChangeMe123! (dev default - change it)'}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
