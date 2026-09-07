import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from './helpers/app.js';

test('на каждый ответ ставятся заголовки безопасности', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/' });

  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.match(response.headers['content-security-policy'], /script-src 'self'/);
  assert.match(response.headers['content-security-policy'], /frame-ancestors 'none'/);
  await cleanup();
});

test('первый запрос выдаёт ключ CSRF в cookie', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/' });

  const csrf = response.cookies.find((cookie) => cookie.name === 'csrf');
  assert.ok(csrf, 'cookie csrf не выставлена');
  assert.equal(csrf.value.length, 64);
  assert.equal(csrf.httpOnly, true);
  await cleanup();
});

test('анонимный запрос не получает ключа сессии', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/' });

  assert.equal(response.cookies.find((cookie) => cookie.name === 'sid'), undefined);
  await cleanup();
});
