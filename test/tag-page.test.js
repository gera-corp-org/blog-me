import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, seedPost } from './helpers/app.js';

test('страница тега показывает только его записи', async () => {
  const { app, cleanup } = await createTestApp();
  seedPost(app, { title: 'Про код', slug: 'pro-kod', tags: ['Код'] });
  seedPost(app, { title: 'Про жизнь', slug: 'pro-zhizn', tags: ['Жизнь'] });

  const response = await app.inject({ method: 'GET', url: '/tag/kod' });

  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes('Про код'));
  assert.ok(!response.body.includes('Про жизнь'));
  await cleanup();
});

test('неизвестный тег отдаёт 404', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/tag/net-takogo' });

  assert.equal(response.statusCode, 404);
  await cleanup();
});
