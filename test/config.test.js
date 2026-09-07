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
  assert.equal(config.trustProxyHops, 1);
});

test('читает значения из окружения', () => {
  const config = loadConfig({
    PORT: '8080',
    DATA_DIR: '/data',
    POSTS_PER_PAGE: '5',
    COOKIE_SECURE: 'false',
    SITE_URL: 'https://blog.example.com/',
    TRUST_PROXY_HOPS: '2',
  });
  assert.equal(config.port, 8080);
  assert.equal(config.databasePath, '/data/blog.db');
  assert.equal(config.uploadsDir, '/data/uploads');
  assert.equal(config.postsPerPage, 5);
  assert.equal(config.cookieSecure, false);
  assert.equal(config.siteUrl, 'https://blog.example.com', 'хвостовой слэш убирается');
  assert.equal(config.trustProxyHops, 2);
});

test('срезает хвостовой слэш у DATA_DIR', () => {
  const config = loadConfig({ DATA_DIR: '/data/' });
  assert.equal(config.databasePath, '/data/blog.db');
  assert.equal(config.uploadsDir, '/data/uploads');
});
