import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../src/db/index.js';
import { applyMigrations } from '../../src/db/migrate.js';

const MIGRATIONS = new URL('../../migrations', import.meta.url).pathname;

export function createTestDatabase() {
  const dir = mkdtempSync(join(tmpdir(), 'blog-test-'));
  const db = openDatabase(join(dir, 'blog.db'));
  applyMigrations(db, MIGRATIONS);

  return {
    db,
    dir,
    cleanup() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
