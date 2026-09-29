// Database backup script (Phase 7 - Database Operations) — MongoDB edition.
//
// Creates a binary backup of the Executive PA database using mongodump
// (single archive file, gzip-compressed).
// Security: the dump contains ALL private data. Store the output in a private,
// encrypted location only (never commit it, never upload it to a shared bucket).
//
// Usage:
//   node scripts/db-backup.js                     # writes backups/epa-<timestamp>.archive.gz
//   node scripts/db-backup.js --out mydump.gz     # custom output file
//
// Requires `mongodump` (Mongo Database Tools) on PATH, or MONGODUMP_BIN env var
// pointing to the binary. Multi-word commands are supported for containers, e.g.
//   MONGODUMP_BIN="docker exec executive-pa-db mongodump"
// DATABASE_URL is read from server/.env (mongodb+srv:// or mongodb://).

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Load server/.env so the script works from the repo root without export juggling.
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function parseArg(name) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? process.argv[idx + 1] : null;
}

function databaseNameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname.replace(/^\//, '');
    // mongodb+srv URLs may embed the db after the host as /db?authSource=...
    return pathname.split('?')[0] || 'unknown';
  } catch {
    return 'unknown';
  }
}

// Strip Prisma-only query params that mongodump rejects.
function toToolsUrl(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('schema');
    u.searchParams.delete('connection_limit');
    u.searchParams.delete('pool_timeout');
    u.searchParams.delete('connect_timeout');
    return u.toString();
  } catch {
    return url;
  }
}

function resolveBin(spec) {
  // Support multi-word commands (e.g. "docker exec container mongodump") by
  // running them through a shell; plain paths/binary names run directly.
  return spec.includes(' ')
    ? { file: spec, shell: true }
    : { file: spec, shell: false };
}

function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Add it to server/.env or the environment.');
    process.exit(1);
  }

  const outArg = parseArg('--out');
  const backupDir = path.resolve(__dirname, '../backups');
  const outFile = outArg
    ? path.resolve(process.cwd(), outArg)
    : path.join(backupDir, `epa-${new Date().toISOString().replace(/[:.]/g, '-')}.archive.gz`);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  // Single gzip-compressed archive keeps dump + metadata in one portable file.
  // When the binary is remote (docker exec/ssh), write the archive on the host by
  // piping stdout to the output file instead of passing --archive <path>, because
  // the remote side cannot see host paths. Quote args to survive shell re-parsing.
  const bin = resolveBin(process.env.MONGODUMP_BIN || 'mongodump');
  const isRemote = /docker|ssh|kubectl/.test(process.env.MONGODUMP_BIN || '');
  const toolsUrl = toToolsUrl(databaseUrl);

  const commonArgs = ['--uri', toolsUrl, '--gzip'];
  let result;
  if (isRemote) {
    const out = fs.openSync(outFile, 'w');
    result = spawnSync(bin.file, [...commonArgs, '--archive'], {
      stdio: ['ignore', out, 'inherit'],
      shell: bin.shell,
    });
    fs.closeSync(out);
  } else {
    result = spawnSync(bin.file, [...commonArgs, '--archive', outFile], {
      stdio: 'inherit',
      shell: bin.shell,
    });
  }

  if (result.error) {
    console.error(`Failed to run mongodump: ${result.error.message}`);
    console.error('Install MongoDB Database Tools or set MONGODUMP_BIN to the mongodump binary path.');
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`mongodump exited with status ${result.status}. Backup FAILED.`);
    process.exit(result.status || 1);
  }

  const size = fs.statSync(outFile).size;
  console.log(`Backup of "${databaseNameFromUrl(databaseUrl)}" written to ${outFile} (${size} bytes).`);
  console.log('Store this file privately and encrypted - it contains all application data.');
}

main();
