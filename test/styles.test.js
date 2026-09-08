import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, seedPost } from './helpers/app.js';

test('таблица стилей отдаётся', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/static/style.css' });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /text\/css/);
  await cleanup();
});

test('страницы не содержат встроенных стилей', async () => {
  const { app, cleanup } = await createTestApp();
  seedPost(app, { title: 'Запись', slug: 'zapis' });

  for (const url of ['/', '/p/zapis', '/admin/login']) {
    const response = await app.inject({ method: 'GET', url });
    assert.ok(!response.body.includes('style="'), `встроенный стиль на ${url}`);
    assert.ok(!response.body.includes('<style'), `блок стилей на ${url}`);
  }
  await cleanup();
});

test('страница объявляет кодировку и масштаб для телефона', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/' });

  assert.ok(response.body.includes('<meta charset="utf-8">'));
  assert.ok(response.body.includes('width=device-width'));
  await cleanup();
});
