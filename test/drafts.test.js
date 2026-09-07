import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, login, seedPost } from './helpers/app.js';

test('владелец видит черновик по обычному адресу', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie } = await login(app);
  seedPost(app, { title: 'Черновик', slug: 'chernovik', status: 'draft' });

  const response = await app.inject({ method: 'GET', url: '/p/chernovik', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes('черновик'), 'на странице есть пометка о черновике');
  await cleanup();
});

test('аноним по тому же адресу получает 404', async () => {
  const { app, cleanup } = await createTestApp();
  seedPost(app, { title: 'Черновик', slug: 'chernovik', status: 'draft' });

  const response = await app.inject({ method: 'GET', url: '/p/chernovik' });

  assert.equal(response.statusCode, 404);
  await cleanup();
});

test('черновик не попадает в ленту даже владельцу', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie } = await login(app);
  seedPost(app, { title: 'Черновик', slug: 'chernovik', status: 'draft' });

  const response = await app.inject({ method: 'GET', url: '/', headers: { cookie } });

  assert.ok(!response.body.includes('Черновик'));
  await cleanup();
});

test('аноним не видит в шапке ссылок админки', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/' });

  assert.ok(!response.body.includes('Выйти'), 'ссылки админки видны без входа');
  await cleanup();
});

test('вошедший видит в шапке ссылок админки', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie } = await login(app);

  const response = await app.inject({ method: 'GET', url: '/', headers: { cookie } });

  assert.ok(response.body.includes('Выйти'));
  await cleanup();
});
