import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from './helpers/app.js';

test('GET /healthz отвечает 200', async () => {
  const { app, cleanup } = await createTestApp();
  const response = await app.inject({ method: 'GET', url: '/healthz' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });
  await cleanup();
});
