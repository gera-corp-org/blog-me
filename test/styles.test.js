import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, seedPost, login } from './helpers/app.js';

test('таблица стилей отдаётся', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/static/style.css' });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /text\/css/);
  await cleanup();
});

test('страницы не содержат встроенных стилей и обработчиков событий', async () => {
  const { app, cleanup } = await createTestApp();
  seedPost(app, { title: 'Запись', slug: 'zapis' });
  const { cookie } = await login(app);

  const pages = [
    ['/', {}],
    ['/p/zapis', {}],
    ['/admin/login', {}],
    ['/admin', { cookie }],
  ];

  for (const [url, headers] of pages) {
    const response = await app.inject({ method: 'GET', url, headers });
    assert.ok(!response.body.includes('style="'), `встроенный стиль на ${url}`);
    assert.ok(!response.body.includes('<style'), `блок стилей на ${url}`);
    // The security policy forbids inline event handlers:
    // an attribute like onsubmit="..." is silently not executed by the browser, and
    // the only protection (e.g. delete confirmation) disappears.
    assert.ok(!/\son\w+\s*=/i.test(response.body), `встроенный обработчик события на ${url}`);
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
