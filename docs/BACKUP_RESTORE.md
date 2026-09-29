# Backup & Restore Runbook

Backups are gzip-compressed single-file archives via `mongodump`, produced by `server/scripts/db-backup.js`. A dump contains **all private data** — store it only in a private, encrypted location (e.g. an encrypted disk or a private storage bucket you control). Never commit it and never upload it to shared/public storage.

## Creating a backup

```bash
npm run db:backup                 # uses DATABASE_URL from server/.env
# -> server/backups/epa-<timestamp>.archive.gz

npm run db:backup -- --out mydump.gz
```

Requires `mongodump` (MongoDB Database Tools) on PATH, or set `MONGODUMP_BIN` to its full path.

**Docker database?** If Mongo runs in a container (no local tools), pass the command through the env var — multi-word commands are supported and Prisma-only URL params (`?schema=`) are stripped automatically:

```bash
MONGODUMP_BIN="docker exec executive-pa-db mongodump" npm run db:backup
MONGORESTORE_BIN="docker exec -i executive-pa-db mongorestore" npm run db:restore -- dump.archive.gz --url "mongodb://user@localhost:27017/target_db"
```

(Remote targets stream the archive over stdin automatically.)

Recommended schedule for personal use: weekly dump after significant changes, plus an ad-hoc dump before any manual database work or app upgrade. The `server/backups/` directory is git-ignored.

## Restoring

```bash
npm run db:restore -- path/to/dump.archive.gz --url "$TARGET_DATABASE_URL"
```

- `mongorestore` must be on PATH (or set `MONGORESTORE_BIN`).
- The script refuses target database names containing "prod" unless `--force` is passed.
- The target database should be empty or dedicated to the restore.
- The archive restores under its **original database name** (namespaces are embedded in the dump). To restore under a different name, add `--nsFrom=<orig>.* --nsTo=<new>.*` via `MONGORESTORE_BIN`.

## Documented restore test (perform after first deployment)

1. Create a scratch database target (never production), e.g. a free Atlas cluster or local Mongo:
   ```bash
   docker run -d --name epa-restore-test -p 27018:27017 mongo:7
   ```
2. Run the restore against it:
   ```bash
   npm run db:restore -- server/backups/<latest>.archive.gz --url "mongodb://localhost:27018/scratch"
   ```
3. Verify document counts match the source:
   ```bash
   mongosh "mongodb://localhost:27018/scratch" --eval "
     ['tasks','people','followUps','notifications','users'].forEach(c =>
       print(c, db.getCollection(c).countDocuments()));"
   ```
   (Collection names match the Prisma `@@map` values in `server/prisma/schema.prisma`.)
4. Spot-check content (a known task title, a recent notification) and that `users` contains exactly one document.
5. Remove the scratch container:
   ```bash
   docker rm -f epa-restore-test
   ```

Record the date and result of each restore test. A backup that has never been restored is not a backup.

## Retention

Keep the last 4–6 archives; delete older ones from your private storage. There is no server-side retention — this app stores no data outside your MongoDB database.
