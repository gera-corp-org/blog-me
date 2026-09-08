import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, seedPost } from './helpers/app.js';
import { toMatchQuery } from '../src/domain/search.js';

test('превращает запрос в выражение поиска', () => {
  assert.equal(toMatchQuery('привет мир'), '"привет"* "мир"*');
  assert.equal(toMatchQuery('  кот  '), '"кот"*');
  assert.equal(toMatchQuery(''), '');
  assert.equal(toMatchQuery('AND OR "*'), '"and"* "or"*', 'служебные символы обезврежены');
});

test('находит запись по слову из текста', async () => {
  const { app, cleanup } = await createTestApp();
  seedPost(app, { title: 'Про котов', slug: 'pro-kotov', body: 'Однажды поселился рыжий кот.' });
  seedPost(app, { title: 'Про собак', slug: 'pro-sobak', body: 'Здесь только про собак.' });

  const response = await app.inject({ method: 'GET', url: '/search?q=рыжий' });

  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes('Про котов'));
  assert.ok(!response.body.includes('Про собак'));
  await cleanup();
});

test('находит по заголовку и по началу слова', async () => {
  const { app, cleanup } = await createTestApp();
  seedPost(app, { title: 'Кубернетес', slug: 'kubernetes', body: 'Текст' });

  const response = await app.inject({ method: 'GET', url: '/search?q=куберн' });

  assert.ok(response.body.includes('Кубернетес'));
  await cleanup();
});

test('черновики в поиск не попадают', async () => {
  const { app, cleanup } = await createTestApp();
  seedPost(app, { title: 'Тайна', slug: 'tayna', body: 'секретное слово', status: 'draft' });

  const response = await app.inject({ method: 'GET', url: '/search?q=секретное' });

  assert.ok(!response.body.includes('Тайна'));
  await cleanup();
});

test('индекс поспевает за правкой и удалением', async () => {
  const { app, cleanup } = await createTestApp();
  const post = seedPost(app, { title: 'Первый', slug: 'perviy', body: 'старое слово' });

  app.posts.update(post.id, {
    slug: 'perviy',
    title: 'Первый',
    bodyMd: 'новое слово',
    bodyHtml: '<p>новое слово</p>',
    excerpt: 'новое слово',
    status: 'published',
  });

  const afterUpdate = await app.inject({ method: 'GET', url: '/search?q=старое' });
  assert.ok(!afterUpdate.body.includes('Первый'), 'старое слово больше не находится');

  const found = await app.inject({ method: 'GET', url: '/search?q=новое' });
  assert.ok(found.body.includes('Первый'));

  app.posts.remove(post.id);
  const afterDelete = await app.inject({ method: 'GET', url: '/search?q=новое' });
  assert.ok(!afterDelete.body.includes('Первый'));
  await cleanup();
});

test('пустой запрос не ломает страницу', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/search?q=' });

  assert.equal(response.statusCode, 200);
  await cleanup();
});
