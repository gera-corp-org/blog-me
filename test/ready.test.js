import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { createTestDatabase } from './helpers/db.js';
import { loadConfig } from '../src/config.js';
import { buildServer } from '../src/server.js';
import { openDatabase } from '../src/db/index.js';
import { createTestApp } from './helpers/app.js';

test('GET /readyz отвечает 200 на мигрированной базе', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/readyz' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });
  await cleanup();
});

test('GET /readyz отвечает 503, пока миграции не применены', async () => {
  const db = openDatabase(':memory:');
  const config = loadConfig({ DATA_DIR: mkdtempSync(join(tmpdir(), 'blog-test-')) });
  const app = buildServer({ config, db });

  const response = await app.inject({ method: 'GET', url: '/readyz' });

  assert.equal(response.statusCode, 503);
  await app.close();
  db.close();
});

test('сервер поднимается при относительном пути к данным', async () => {
  // Ровно настройка из README для локального запуска. Библиотека отдачи
  // файлов требует абсолютный путь и роняет приложение при старте, а все
  // остальные тесты подставляют абсолютный временный каталог и этого не
  // видят — как и контейнер, где путь /data.
  const relative = './data/test-relative';
  const { db, cleanup } = createTestDatabase();
  const app = buildServer({ config: loadConfig({ DATA_DIR: relative }), db });

  try {
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    assert.equal(response.statusCode, 200);
  } finally {
    await app.close();
    cleanup();
    rmSync(relative, { recursive: true, force: true });
  }
});
