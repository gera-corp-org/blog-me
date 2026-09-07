import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { buildServer } from '../src/server.js';

test('GET /healthz отвечает 200', async () => {
  const app = buildServer({ config: loadConfig({}), db: null });
  const response = await app.inject({ method: 'GET', url: '/healthz' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });
  await app.close();
});
