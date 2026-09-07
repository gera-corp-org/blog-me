import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, seedPost } from './helpers/app.js';

test('лента показывает опубликованные записи и прячет черновики', async () => {
  const { app, cleanup } = await createTestApp();
  seedPost(app, { title: 'Опубликованная' });
  seedPost(app, { title: 'Черновик', status: 'draft' });

  const response = await app.inject({ method: 'GET', url: '/' });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /text\/html/);
  assert.ok(response.body.includes('Опубликованная'));
  assert.ok(!response.body.includes('Черновик'));
  await cleanup();
});

test('лента разбита на страницы', async () => {
  const { app, cleanup } = await createTestApp({ POSTS_PER_PAGE: '2' });
  for (let index = 1; index <= 3; index += 1) {
    seedPost(app, { title: `Запись ${index}`, slug: `zapis-${index}` });
  }

  const second = await app.inject({ method: 'GET', url: '/?page=2' });

  assert.equal(second.statusCode, 200);
  assert.ok(second.body.includes('Запись 1'));
  assert.ok(!second.body.includes('Запись 3'));
  await cleanup();
});

test('страница записи отдаёт разметку тела', async () => {
  const { app, cleanup } = await createTestApp();
  seedPost(app, { title: 'Привет, мир', body: 'Текст с **жирным**.', tags: ['Заметки'] });

  const response = await app.inject({ method: 'GET', url: '/p/privet-mir' });

  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes('<strong>жирным</strong>'));
  assert.ok(response.body.includes('#Заметки'));
  await cleanup();
});

test('черновик анониму не показывается', async () => {
  const { app, cleanup } = await createTestApp();
  seedPost(app, { title: 'Черновик', slug: 'chernovik', status: 'draft' });

  const response = await app.inject({ method: 'GET', url: '/p/chernovik' });

  assert.equal(response.statusCode, 404, 'именно 404, а не 403');
  await cleanup();
});

test('несуществующий адрес отдаёт страницу 404', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/p/net-takogo' });

  assert.equal(response.statusCode, 404);
  assert.match(response.headers['content-type'], /text\/html/);
  await cleanup();
});
