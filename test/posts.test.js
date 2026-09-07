import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from './helpers/db.js';
import { createPostRepository } from '../src/db/posts.js';
import { createTagRepository } from '../src/db/tags.js';

const fields = (overrides = {}) => ({
  slug: 'privet-mir',
  title: 'Привет, мир',
  bodyMd: 'Текст записи',
  bodyHtml: '<p>Текст записи</p>',
  excerpt: 'Текст записи',
  status: 'draft',
  ...overrides,
});

test('создаёт черновик без даты публикации', () => {
  const { db, cleanup } = createTestDatabase();
  const posts = createPostRepository(db);

  const post = posts.create(fields());

  assert.equal(post.status, 'draft');
  assert.equal(post.published_at, null);
  assert.equal(post.title, 'Привет, мир');
  assert.ok(post.created_at);
  cleanup();
});

test('проставляет дату публикации при публикации и не меняет её потом', () => {
  const { db, cleanup } = createTestDatabase();
  const posts = createPostRepository(db);

  const draft = posts.create(fields());
  const published = posts.update(draft.id, fields({ status: 'published' }));
  const edited = posts.update(draft.id, fields({ status: 'published', title: 'Правка' }));

  assert.ok(published.published_at);
  assert.equal(edited.published_at, published.published_at, 'дата первой публикации сохраняется');
  assert.equal(edited.title, 'Правка');
  cleanup();
});

test('slugExists умеет исключать саму запись', () => {
  const { db, cleanup } = createTestDatabase();
  const posts = createPostRepository(db);
  const post = posts.create(fields());

  assert.equal(posts.slugExists('privet-mir'), true);
  assert.equal(posts.slugExists('privet-mir', post.id), false);
  assert.equal(posts.slugExists('svobodno'), false);
  cleanup();
});

test('лента отдаёт только опубликованные, новые первыми', () => {
  const { db, cleanup } = createTestDatabase();
  const posts = createPostRepository(db);
  posts.create(fields({ slug: 'first', status: 'published' }));
  posts.create(fields({ slug: 'second', status: 'published' }));
  posts.create(fields({ slug: 'draft' }));

  const list = posts.listPublished({ limit: 10, offset: 0 });

  assert.deepEqual(list.map((post) => post.slug), ['second', 'first']);
  assert.equal(posts.countPublished(), 2);
  cleanup();
});

test('постраничность режет выдачу', () => {
  const { db, cleanup } = createTestDatabase();
  const posts = createPostRepository(db);
  for (let index = 1; index <= 3; index += 1) {
    posts.create(fields({ slug: `post-${index}`, status: 'published' }));
  }

  const page = posts.listPublished({ limit: 2, offset: 2 });

  assert.equal(page.length, 1);
  assert.equal(page[0].slug, 'post-1');
  cleanup();
});

test('listAll отдаёт и черновики, с фильтром по статусу', () => {
  const { db, cleanup } = createTestDatabase();
  const posts = createPostRepository(db);
  posts.create(fields({ slug: 'a', status: 'published' }));
  posts.create(fields({ slug: 'b' }));

  assert.equal(posts.listAll().length, 2);
  assert.deepEqual(posts.listAll('draft').map((post) => post.slug), ['b']);
  cleanup();
});

test('выборка по тегу берёт только опубликованные', () => {
  const { db, cleanup } = createTestDatabase();
  const posts = createPostRepository(db);
  const tags = createTagRepository(db);
  const published = posts.create(fields({ slug: 'a', status: 'published' }));
  const draft = posts.create(fields({ slug: 'b' }));
  tags.setForPost(published.id, ['Код']);
  tags.setForPost(draft.id, ['Код']);

  assert.deepEqual(posts.listByTag('kod', { limit: 10, offset: 0 }).map((post) => post.slug), ['a']);
  assert.equal(posts.countByTag('kod'), 1);
  cleanup();
});

test('удаление записи уносит связи с тегами', () => {
  const { db, cleanup } = createTestDatabase();
  const posts = createPostRepository(db);
  const tags = createTagRepository(db);
  const post = posts.create(fields({ status: 'published' }));
  tags.setForPost(post.id, ['Код']);

  posts.remove(post.id);

  assert.equal(posts.findById(post.id), undefined);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM post_tags').get().total, 0);
  cleanup();
});
