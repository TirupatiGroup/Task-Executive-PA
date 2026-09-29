// Database restore script (Phase 7 - Database Operations) — MongoDB edition.
//
// Restores a single-file archive produced by scripts/db-backup.js into a target
// database using mongorestore. Intended for the documented restore TEST (restore
// into a scratch database and verify counts) and for genuine recovery.
//
// SAFETY: the target database must be EMPTY or dedicated to this restore.
// This script refuses to run against a URL whose database name looks like a
// production name unless you pass --force. Never point it at a live database.
//
// Usage:
//   node scripts/db-restore.js path/to/dump.archive.gz --url "$TARGET_DATABASE_URL"
//   node scripts/db-restore.js path/to/dump.archive.gz --url ... --force   # override name guard
//
// Requires `mongorestore` (Mongo Database Tools) on PATH, or MONGORESTORE_BIN
// env var. Multi-word commands are supported for containers, e.g.
//   MONGORESTORE_BIN="docker exec -i executive-pa-db mongorestore"
// The default DATABASE_URL from server/.env is used when --url is omitted.
// NOTE: the archive restores under its ORIGINAL database name (namespaces are
// embedded in the dump). To restore under a different name, append remap args
// through MONGORESTORE_BIN, e.g. "mongorestore --nsFrom=executive_pa.* --nsTo=scratch.*".

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function parseArg(name) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? process.argv[idx + 1] : null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function databaseNameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname.replace(/^\//, '');
    return pathname.split('?')[0] || 'unknown';
  } catch {
    return 'unknown';
  }
}

// Strip Prisma-only query params that mongorestore rejects.
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

function main() {
  const dumpFile = process.argv[2];
  if (!dumpFile || !fs.existsSync(dumpFile)) {
    console.error('Usage: node scripts/db-restore.js <dump.archive.gz> [--url TARGET_DATABASE_URL] [--force]');
    process.exit(1);
  }

  const targetUrl = parseArg('--url') || process.env.DATABASE_URL;
  if (!targetUrl) {
    console.error('No target database: pass --url or set DATABASE_URL in server/.env.');
    process.exit(1);
  }

  const dbName = databaseNameFromUrl(targetUrl);
  if (!hasFlag('--force') && /prod/i.test(dbName)) {
    console.error(`Refusing to restore into database named "${dbName}" without --force.`);
    process.exit(1);
  }

  // Support multi-word commands (e.g. "docker exec -i container mongorestore") via shell.
  // When the target is remote (docker exec), pipe the archive through stdin
  // (mongorestore reads --archive from stdin) instead of a host path.
  const binSpec = process.env.MONGORESTORE_BIN || 'mongorestore';
  const viaShell = binSpec.includes(' ');
  const isRemote = /docker|ssh|kubectl/.test(binSpec);
  const toolsUrl = toToolsUrl(targetUrl);

  const commonArgs = ['--uri', toolsUrl, '--gzip', '--archive'];
  let result;
  if (isRemote) {
    // spawnSync's input option only accepts strings/buffers; read the archive
    // fully into memory (dumps for this single-user app are small).
    const dumpBytes = fs.readFileSync(path.resolve(dumpFile));
    result = spawnSync(binSpec, commonArgs, {
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: viaShell,
      input: dumpBytes,
    });
  } else {
    result = spawnSync(binSpec, [...commonArgs, path.resolve(dumpFile)], {
      stdio: 'inherit',
      shell: viaShell,
    });
  }

  if (result.error) {
    console.error(`Failed to run mongorestore: ${result.error.message}`);
    console.error('Install MongoDB Database Tools or set MONGORESTORE_BIN to the mongorestore binary path.');
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`mongorestore exited with status ${result.status}. Restore FAILED.`);
    process.exit(result.status || 1);
  }

  console.log(`Restore into "${dbName}" completed without errors.`);
  console.log('Documented verification step: compare document counts, e.g.');
  console.log('  mongosh "$TARGET_DATABASE_URL" --eval "db.tasks.countDocuments()"');
}

main();
