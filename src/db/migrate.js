import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function migrationFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, version: Number.parseInt(name.slice(0, 3), 10) }));
}

export function latestMigrationVersion(dir) {
  const files = migrationFiles(dir);
  return files.length === 0 ? 0 : files[files.length - 1].version;
}

export function applyMigrations(db, dir) {
  const current = db.pragma('user_version', { simple: true });
  let applied = 0;

  for (const file of migrationFiles(dir)) {
    if (file.version <= current) continue;

    const sql = readFileSync(join(dir, file.name), 'utf8');
    const run = db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${file.version}`);
    });
    run();
    applied += 1;
  }

  return applied;
}
