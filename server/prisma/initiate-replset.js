// One-shot: initialize the single-node MongoDB replica set on localhost:27018.
// Uses the native mongodb driver (available as Prisma transitive dep) so we
// don't need mongosh installed on the host.

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Load .env manually when running directly via `node` (outside npm run / dotenvx).
function loadDotenv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadDotenv();

const DB_URL = process.env.DATABASE_URL || 'mongodb://localhost:27018/executive_pa';
const CONNECTION = DB_URL.replace(/\/[^/]*$/, '/admin');

async function main() {
  console.log('Connecting to MongoDB replica set host at', CONNECTION.replace(/\/\/[^@]*@/, '//***:***@'));
  const client = new MongoClient(CONNECTION, { directConnection: true, serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const admin = client.db('admin');

    // Check if already initiated.
    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      console.log('Replica set already initiated. Set:', status.set, 'State:', status.myState);
      return;
    } catch (_err) {
      // Not yet initiated — proceed.
    }

    const hostMatch = CONNECTION.match(/\/\/([^:/]+)(:\d+)?/);
    const host = (hostMatch && hostMatch[1]) || 'localhost';
    const portMatch = CONNECTION.match(/:(\d+)(\/|$)/);
    const port = (portMatch && parseInt(portMatch[1], 10)) || 27017;

    const result = await admin.command({
      replSetInitiate: {
        _id: 'rs0',
        members: [{ _id: 0, host: `${host}:${port}` }],
      },
    });
    console.log('replSetInitiate result:', JSON.stringify(result));

    // Poll briefly until PRIMARY/SECONDARY transitions stabilize.
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const s = await admin.command({ replSetGetStatus: 1 });
        console.log(`  [${i}] state=${s.myState} (1=PRIMARY) set=${s.set}`);
        if (s.myState === 1 || s.myState === 2) break;
      } catch (_) { /* still transitioning */ }
    }
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
