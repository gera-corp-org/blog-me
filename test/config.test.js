import test from 'node:test';
import assert from 'node:assert/strict';
import { isAbsolute, join } from 'node:path';
import { loadConfig } from '../src/config.js';

test('подставляет значения по умолчанию', () => {
  const config = loadConfig({});
  assert.equal(config.port, 3000);
  assert.equal(config.postsPerPage, 10);
  assert.equal(config.sessionTtlDays, 30);
  assert.equal(config.backupKeep, 7);
  assert.equal(config.cookieSecure, true);
  assert.equal(config.databasePath, join(process.cwd(), 'data', 'blog.db'));
  assert.deepEqual(config.trustProxy, ['loopback', 'uniquelocal'], 'по умолчанию доверяем петле и частным сетям');
});

test('читает значения из окружения', () => {
  const config = loadConfig({
    PORT: '8080',
    DATA_DIR: '/data',
    POSTS_PER_PAGE: '5',
    COOKIE_SECURE: 'false',
    SITE_URL: 'https://blog.example.com/',
    TRUST_PROXY: '10.0.0.0/8, 192.168.0.0/16',
  });
  assert.equal(config.port, 8080);
  assert.equal(config.databasePath, '/data/blog.db');
  assert.equal(config.uploadsDir, '/data/uploads');
  assert.equal(config.postsPerPage, 5);
  assert.equal(config.cookieSecure, false);
  assert.equal(config.siteUrl, 'https://blog.example.com', 'хвостовой слэш убирается');
  assert.deepEqual(config.trustProxy, ['10.0.0.0/8', '192.168.0.0/16'], 'список разбирается по запятой, пробелы срезаются');
});

test('пути от DATA_DIR получаются абсолютными', () => {
  // A relative path breaks file serving: the library requires an absolute one
  // and crashes at startup. The default value is exactly relative,
  // so the README's startup command was the one that crashed.
  const config = loadConfig({ DATA_DIR: './data' });

  assert.ok(isAbsolute(config.dataDir), `dataDir не абсолютный: ${config.dataDir}`);
  assert.ok(isAbsolute(config.databasePath), `databasePath не абсолютный: ${config.databasePath}`);
  assert.ok(isAbsolute(config.uploadsDir), `uploadsDir не абсолютный: ${config.uploadsDir}`);
  assert.ok(isAbsolute(config.backupsDir), `backupsDir не абсолютный: ${config.backupsDir}`);
  assert.equal(config.databasePath, join(process.cwd(), 'data', 'blog.db'));
});

test('срезает хвостовой слэш у DATA_DIR', () => {
  const config = loadConfig({ DATA_DIR: '/data/' });
  assert.equal(config.databasePath, '/data/blog.db');
  assert.equal(config.uploadsDir, '/data/uploads');
});

test('пустой TRUST_PROXY отключает доверие заголовку', () => {
  // Fastify expects false here specifically: it would take an empty array for a list
  // and would keep parsing the header.
  assert.equal(loadConfig({ TRUST_PROXY: '' }).trustProxy, false);
  assert.equal(loadConfig({ TRUST_PROXY: ' , ' }).trustProxy, false);
});
