// Safe, non-destructive migration: simple email+password auth.
// - Adds nullable password_hash (bcrypt) column.
// - Drops the Microsoft OID requirement and its unique index.
// Existing user rows are preserved; only Microsoft-specific identity data is removed.

-- CreateTable is not needed; alter existing users table.
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;

-- Make Microsoft OID optional and drop its uniqueness (kept as nullable column
-- for historical data; new password users get NULL).
ALTER TABLE "users" ALTER COLUMN "microsoft_oid" DROP NOT NULL;
DROP INDEX IF EXISTS "users_microsoft_oid_key";
