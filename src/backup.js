import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const DAY_MS = 24 * 60 * 60 * 1000;
const NAME_PATTERN = /^blog-\d{4}-\d{2}-\d{2}\.db$/;

export function makeBackup(db, backupsDir, keep, now = new Date()) {
  mkdirSync(backupsDir, { recursive: true });

  const target = join(backupsDir, `blog-${now.toISOString().slice(0, 10)}.db`);
  rmSync(target, { force: true });
  db.prepare('VACUUM INTO ?').run(target);

  const existing = readdirSync(backupsDir).filter((name) => NAME_PATTERN.test(name)).sort();
  for (const outdated of existing.slice(0, Math.max(0, existing.length - keep))) {
    rmSync(join(backupsDir, outdated), { force: true });
  }

  return target;
}

export function startBackupSchedule({ db, config, log }) {
  const run = () => {
    try {
      const file = makeBackup(db, config.backupsDir, config.backupKeep);
      log?.info(`снимок базы: ${file}`);
    } catch (error) {
      log?.error(error, 'снимок базы не удался');
    }
  };

  run();
  const timer = setInterval(run, DAY_MS);
  timer.unref();

  return () => clearInterval(timer);
}
