import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, seedPost } from './helpers/app.js';
import { buildAtomFeed } from '../src/domain/feed.js';

const site = { title: 'Блог', description: 'Записи', url: 'https://blog.example.com', author: 'Гера' };

test('экранирует опасные символы в заголовке', () => {
  const xml = buildAtomFeed({
    site,
    posts: [{
      slug: 'a', title: 'Кот & <пёс>', excerpt: 'Анонс', body_html: '<p>Тело</p>',
      published_at: '2026-09-01T10:00:00.000Z', updated_at: '2026-09-01T10:00:00.000Z',
    }],
  });

  assert.ok(xml.includes('Кот &amp; &lt;пёс&gt;'));
  assert.ok(!xml.includes('<пёс>'));
});

test('ссылки в ленте абсолютные', () => {
  const xml = buildAtomFeed({
    site,
    posts: [{
      slug: 'privet', title: 'Привет', excerpt: 'Анонс', body_html: '<p>Тело</p>',
      published_at: '2026-09-01T10:00:00.000Z', updated_at: '2026-09-01T10:00:00.000Z',
    }],
  });

  assert.ok(xml.includes('https://blog.example.com/p/privet'));
});

test('пустая лента остаётся правильным документом', () => {
  const xml = buildAtomFeed({ site, posts: [] });

  assert.ok(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>'));
  assert.ok(xml.trimEnd().endsWith('</feed>'));
});

test('GET /feed.xml отдаёт опубликованные записи', async () => {
  const { app, cleanup } = await createTestApp({ SITE_URL: 'https://blog.example.com' });
  seedPost(app, { title: 'Опубликованная', slug: 'op' });
  seedPost(app, { title: 'Черновик', slug: 'ch', status: 'draft' });

  const response = await app.inject({ method: 'GET', url: '/feed.xml' });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /application\/atom\+xml/);
  assert.ok(response.body.includes('Опубликованная'));
  assert.ok(!response.body.includes('Черновик'));
  assert.ok(response.body.includes('https://blog.example.com/p/op'));
  await cleanup();
});
