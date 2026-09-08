import { mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DAY_MS = 24 * 60 * 60 * 1000;
const NAME_PATTERN = /^blog-\d{4}-\d{2}-\d{2}\.db$/;
const TEMPORARY_PATTERN = /^blog-\d{4}-\d{2}-\d{2}\.db\.tmp$/;

export function makeBackup(db, backupsDir, keep, now = new Date()) {
  mkdirSync(backupsDir, { recursive: true });

  const target = join(backupsDir, `blog-${now.toISOString().slice(0, 10)}.db`);

  const temporary = `${target}.tmp`;

  // Any .tmp found here is a leftover from a previously interrupted snapshot:
  // snapshots are made synchronously, so two cannot exist at once. Leftovers from
  // past dates don't match the snapshot name pattern and never enter rotation, so
  // otherwise they would pile up forever, each one the size of the database.
  for (const orphan of readdirSync(backupsDir).filter((name) => TEMPORARY_PATTERN.test(name))) {
    rmSync(join(backupsDir, orphan), { force: true });
  }

  db.prepare('VACUUM INTO ?').run(temporary);
  rmSync(target, { force: true });
  renameSync(temporary, target);

  // Only regular files go into the deletion queue. A directory with a similar
  // name would otherwise break rotation forever: there's no way to delete it, and
  // since it sits first in the queue, the queue never advances on any later day.
  const existing = readdirSync(backupsDir)
    .filter((name) => NAME_PATTERN.test(name) && statSync(join(backupsDir, name)).isFile())
    .sort();
  for (const outdated of existing.slice(0, Math.max(0, existing.length - keep))) {
    rmSync(join(backupsDir, outdated), { force: true });
  }

  return target;
}

export function startBackupSchedule({ db, sessions, config, log }) {
  // Expired sessions are cleaned on the same daily tick as the snapshot: there's
  // no point in a separate timer for them, and without one the sessions table
  // would grow without limit between rare restarts.
  const run = () => {
    try {
      const file = makeBackup(db, config.backupsDir, config.backupKeep);
      log?.info(`снимок базы: ${file}`);
      sessions.purgeExpired();
    } catch (error) {
      log?.error(error, 'снимок базы не удался');
    }
  };

  run();
  const timer = setInterval(run, DAY_MS);
  timer.unref();

  return () => clearInterval(timer);
}
