import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db/index.js';
import { applyMigrations, latestMigrationVersion } from '../src/db/migrate.js';

const MIGRATIONS = new URL('../migrations', import.meta.url).pathname;

test('применяет миграции и создаёт таблицы', () => {
  const dir = mkdtempSync(join(tmpdir(), 'blog-test-'));
  const db = openDatabase(join(dir, 'blog.db'));

  const applied = applyMigrations(db, MIGRATIONS);

  assert.ok(applied >= 1);
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name);
  for (const name of ['posts', 'tags', 'post_tags', 'users', 'sessions']) {
    assert.ok(tables.includes(name), `нет таблицы ${name}`);
  }
  assert.equal(db.pragma('user_version', { simple: true }), latestMigrationVersion(MIGRATIONS));

  db.close();
  rmSync(dir, { recursive: true, force: true });
});

test('повторный запуск ничего не меняет', () => {
  const dir = mkdtempSync(join(tmpdir(), 'blog-test-'));
  const db = openDatabase(join(dir, 'blog.db'));

  applyMigrations(db, MIGRATIONS);
  const second = applyMigrations(db, MIGRATIONS);

  assert.equal(second, 0, 'во второй раз применять нечего');

  db.close();
  rmSync(dir, { recursive: true, force: true });
});

test('внешние ключи включены', () => {
  const dir = mkdtempSync(join(tmpdir(), 'blog-test-'));
  const db = openDatabase(join(dir, 'blog.db'));
  applyMigrations(db, MIGRATIONS);

  assert.throws(
    () => db.prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (999, 999)').run(),
    /FOREIGN KEY/,
  );

  db.close();
  rmSync(dir, { recursive: true, force: true });
});
