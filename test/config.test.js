import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

test('подставляет значения по умолчанию', () => {
  const config = loadConfig({});
  assert.equal(config.port, 3000);
  assert.equal(config.postsPerPage, 10);
  assert.equal(config.sessionTtlDays, 30);
  assert.equal(config.backupKeep, 7);
  assert.equal(config.cookieSecure, true);
  assert.equal(config.databasePath, './data/blog.db');
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

test('срезает хвостовой слэш у DATA_DIR', () => {
  const config = loadConfig({ DATA_DIR: '/data/' });
  assert.equal(config.databasePath, '/data/blog.db');
  assert.equal(config.uploadsDir, '/data/uploads');
});

test('пустой TRUST_PROXY отключает доверие заголовку', () => {
  // Fastify ждёт здесь именно false: пустой массив он принял бы за список
  // и продолжил бы разбирать заголовок.
  assert.equal(loadConfig({ TRUST_PROXY: '' }).trustProxy, false);
  assert.equal(loadConfig({ TRUST_PROXY: ' , ' }).trustProxy, false);
});
