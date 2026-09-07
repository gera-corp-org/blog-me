import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from './helpers/db.js';
import { createTagRepository, parseTagInput } from '../src/db/tags.js';

test('parseTagInput разбирает строку и убирает повторы', () => {
  assert.deepEqual(parseTagInput('заметки, код ,заметки'), ['заметки', 'код']);
  assert.deepEqual(parseTagInput(''), []);
  assert.deepEqual(parseTagInput(undefined), []);
});

test('привязывает теги к записи и читает их обратно', () => {
  const { db, cleanup } = createTestDatabase();
  const tags = createTagRepository(db);
  const post = db
    .prepare(`INSERT INTO posts (slug, title, body_md, body_html, excerpt, status, created_at, updated_at)
              VALUES ('a', 'A', 'a', '<p>a</p>', 'a', 'published', '2026-09-01', '2026-09-01') RETURNING id`)
    .get();

  tags.setForPost(post.id, ['Заметки', 'Код']);

  assert.deepEqual(tags.forPost(post.id).map((tag) => tag.name), ['Заметки', 'Код']);
  assert.equal(tags.findBySlug('zametki').name, 'Заметки');
  cleanup();
});

test('повторная привязка заменяет набор тегов и убирает осиротевшие', () => {
  const { db, cleanup } = createTestDatabase();
  const tags = createTagRepository(db);
  const post = db
    .prepare(`INSERT INTO posts (slug, title, body_md, body_html, excerpt, status, created_at, updated_at)
              VALUES ('a', 'A', 'a', '<p>a</p>', 'a', 'published', '2026-09-01', '2026-09-01') RETURNING id`)
    .get();

  tags.setForPost(post.id, ['Старый']);
  tags.setForPost(post.id, ['Новый']);

  assert.deepEqual(tags.forPost(post.id).map((tag) => tag.name), ['Новый']);
  assert.equal(tags.findBySlug('staryy'), undefined, 'осиротевший тег удалён');
  cleanup();
});

test('forPosts возвращает теги пачкой', () => {
  const { db, cleanup } = createTestDatabase();
  const tags = createTagRepository(db);
  const insert = db.prepare(`INSERT INTO posts (slug, title, body_md, body_html, excerpt, status, created_at, updated_at)
                             VALUES (?, ?, 'a', '<p>a</p>', 'a', 'published', '2026-09-01', '2026-09-01') RETURNING id`);
  const first = insert.get('a', 'A');
  const second = insert.get('b', 'B');
  tags.setForPost(first.id, ['Один']);

  const map = tags.forPosts([first.id, second.id]);

  assert.deepEqual(map.get(first.id).map((tag) => tag.name), ['Один']);
  assert.deepEqual(map.get(second.id), []);
  assert.deepEqual(tags.forPosts([]).size, 0);
  cleanup();
});

test('listUsed считает только опубликованные записи', () => {
  const { db, cleanup } = createTestDatabase();
  const tags = createTagRepository(db);
  const insert = db.prepare(`INSERT INTO posts (slug, title, body_md, body_html, excerpt, status, created_at, updated_at)
                             VALUES (?, ?, 'a', '<p>a</p>', 'a', ?, '2026-09-01', '2026-09-01') RETURNING id`);
  const published = insert.get('a', 'A', 'published');
  const draft = insert.get('b', 'B', 'draft');
  tags.setForPost(published.id, ['Общий']);
  tags.setForPost(draft.id, ['Общий']);

  const used = tags.listUsed();

  assert.equal(used.length, 1);
  assert.equal(used[0].count, 1);
  cleanup();
});
