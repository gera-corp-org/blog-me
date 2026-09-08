import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestDatabase } from './helpers/db.js';
import { openDatabase } from '../src/db/index.js';
import { makeBackup } from '../src/backup.js';

test('делает снимок, названный по дате', () => {
  const { db, dir, cleanup } = createTestDatabase();
  const backups = join(dir, 'backups');

  const file = makeBackup(db, backups, 7, new Date('2026-09-07T12:00:00.000Z'));

  assert.equal(file, join(backups, 'blog-2026-09-07.db'));
  assert.deepEqual(readdirSync(backups), ['blog-2026-09-07.db']);
  cleanup();
});

test('снимок открывается как полноценная база', () => {
  const { db, dir, cleanup } = createTestDatabase();
  db.prepare(`INSERT INTO posts (slug, title, body_md, body_html, excerpt, status, created_at, updated_at)
              VALUES ('a', 'Заголовок', 'a', '<p>a</p>', 'a', 'published', '2026-09-01', '2026-09-01')`).run();

  const file = makeBackup(db, join(dir, 'backups'), 7, new Date('2026-09-07T12:00:00.000Z'));

  const copy = openDatabase(file);
  assert.equal(copy.prepare('SELECT title FROM posts').get().title, 'Заголовок');
  copy.close();
  cleanup();
});

test('оставляет только заданное число снимков', () => {
  const { db, dir, cleanup } = createTestDatabase();
  const backups = join(dir, 'backups');

  makeBackup(db, backups, 2, new Date('2026-09-01T00:00:00.000Z'));
  makeBackup(db, backups, 2, new Date('2026-09-02T00:00:00.000Z'));
  makeBackup(db, backups, 2, new Date('2026-09-03T00:00:00.000Z'));

  assert.deepEqual(readdirSync(backups).sort(), ['blog-2026-09-02.db', 'blog-2026-09-03.db']);
  cleanup();
});

test('каталог с именем снимка не ломает ротацию', () => {
  const { db, dir, cleanup } = createTestDatabase();
  const backups = join(dir, 'backups');
  // Такой каталог мог остаться от чужого инструмента. Раньше он вставал
  // первым в очередь на удаление, ротация падала и не двигалась никогда.
  mkdirSync(join(backups, 'blog-2020-01-01.db'), { recursive: true });

  const file = makeBackup(db, backups, 1, new Date('2026-09-07T12:00:00.000Z'));

  assert.ok(existsSync(file), 'снимок не создан');
  assert.ok(existsSync(join(backups, 'blog-2020-01-01.db')), 'посторонний каталог тронут');
  cleanup();
});

test('обрывок прерванного снимка не занимает имя годного', () => {
  const { db, dir, cleanup } = createTestDatabase();
  const backups = join(dir, 'backups');
  mkdirSync(backups, { recursive: true });
  // Так выглядит файл, оставшийся от снимка, прерванного на середине.
  writeFileSync(join(backups, 'blog-2026-09-07.db.tmp'), 'обрывок');
  // Обрывок за другое число: под шаблон имени снимка он не подходит, а
  // значит ротация его никогда не удалит — убирать надо отдельно.
  writeFileSync(join(backups, 'blog-2026-09-05.db.tmp'), 'обрывок постарше');

  makeBackup(db, backups, 7, new Date('2026-09-07T12:00:00.000Z'));

  assert.deepEqual(readdirSync(backups), ['blog-2026-09-07.db'], 'обрывок остался в каталоге');
  const copy = openDatabase(join(backups, 'blog-2026-09-07.db'));
  assert.equal(copy.prepare('SELECT COUNT(*) AS total FROM posts').get().total, 0);
  copy.close();
  cleanup();
});

test('повторный снимок в тот же день перезаписывает файл', () => {
  const { db, dir, cleanup } = createTestDatabase();
  const backups = join(dir, 'backups');
  const day = new Date('2026-09-07T12:00:00.000Z');

  makeBackup(db, backups, 7, day);
  makeBackup(db, backups, 7, day);

  assert.deepEqual(readdirSync(backups), ['blog-2026-09-07.db']);
  cleanup();
});
