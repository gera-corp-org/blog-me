import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, seedPost } from './helpers/app.js';

test('просмотр главной учитывается', async () => {
  const { app, cleanup } = await createTestApp();
  seedPost(app, { title: 'Запись', slug: 'zapis' });

  await app.inject({ method: 'GET', url: '/' });
  await app.inject({ method: 'GET', url: '/' });

  assert.equal(app.pageViews.byPath('/'), 2);
  assert.equal(app.pageViews.total(), 2);
  await cleanup();
});

test('просмотр записи учитывается отдельно', async () => {
  const { app, cleanup } = await createTestApp();
  seedPost(app, { title: 'Запись', slug: 'zapis' });

  await app.inject({ method: 'GET', url: '/p/zapis' });

  assert.equal(app.pageViews.byPath('/p/zapis'), 1);
  assert.equal(app.pageViews.byPath('/'), 0);
  await cleanup();
});

test('статика, медиа, фид и пробы не учитываются', async () => {
  const { app, cleanup } = await createTestApp();
  seedPost(app, { title: 'Запись', slug: 'zapis' });

  await app.inject({ method: 'GET', url: '/static/style.css' });
  await app.inject({ method: 'GET', url: '/feed.xml' });
  await app.inject({ method: 'GET', url: '/healthz' });
  await app.inject({ method: 'GET', url: '/readyz' });

  assert.equal(app.pageViews.total(), 0);
  await cleanup();
});

test('404 и админка не учитываются', async () => {
  const { app, cleanup } = await createTestApp();

  await app.inject({ method: 'GET', url: '/p/net-takogo' });
  await app.inject({ method: 'GET', url: '/admin/login' });

  assert.equal(app.pageViews.total(), 0);
  await cleanup();
});

test('подвал показывает число просмотров', async () => {
  const { app, cleanup } = await createTestApp();
  seedPost(app, { title: 'Запись', slug: 'zapis' });

  await app.inject({ method: 'GET', url: '/' });
  const response = await app.inject({ method: 'GET', url: '/' });

  assert.match(response.body, /Просмотров: 1/);
  await cleanup();
});

test('страница статистики требует входа', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/admin/stats' });

  assert.equal(response.statusCode, 303);
  await cleanup();
});

test('репозиторий считает сумму и отдаёт список по убыванию', async () => {
  const { app, cleanup } = await createTestApp();

  app.pageViews.increment('/');
  app.pageViews.increment('/');
  app.pageViews.increment('/p/a');

  assert.equal(app.pageViews.total(), 3);
  assert.deepEqual(
    app.pageViews.list().map((row) => [row.path, row.views]),
    [['/', 2], ['/p/a', 1]],
  );
  await cleanup();
});
