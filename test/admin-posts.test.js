import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, login, seedPost } from './helpers/app.js';

const post = (cookie, fields) => ({
  headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
  payload: new URLSearchParams(fields).toString(),
});

test('создаёт черновик и уводит на страницу правки', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);

  const response = await app.inject({
    method: 'POST',
    url: '/admin/posts',
    ...post(cookie, { title: 'Привет, мир', slug: '', tags: 'Заметки, Код', body: 'Текст', action: 'draft', _csrf: csrf }),
  });

  assert.equal(response.statusCode, 303);
  const created = app.posts.findBySlug('privet-mir');
  assert.equal(created.status, 'draft');
  assert.equal(created.body_html.includes('<p>Текст</p>'), true);
  assert.deepEqual(app.tags.forPost(created.id).map((tag) => tag.name), ['Заметки', 'Код']);
  assert.equal(response.headers.location, `/admin/posts/${created.id}/edit`);
  await cleanup();
});

test('создание записи без ключа CSRF отклоняется, даже с действующей сессией', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie } = await login(app);

  const response = await app.inject({
    method: 'POST',
    url: '/admin/posts',
    ...post(cookie, { title: 'Без ключа', slug: '', tags: '', body: 'Текст', action: 'draft' }),
  });

  assert.equal(response.statusCode, 403);
  assert.equal(app.posts.findBySlug('bez-klyucha'), undefined);
  await cleanup();
});

test('кнопка «Опубликовать» ставит статус published', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);

  await app.inject({
    method: 'POST',
    url: '/admin/posts',
    ...post(cookie, { title: 'Публикую', slug: '', tags: '', body: 'Текст', action: 'publish', _csrf: csrf }),
  });

  const created = app.posts.findBySlug('publikuyu');
  assert.equal(created.status, 'published');
  assert.ok(created.published_at);
  await cleanup();
});

test('столкновение слагов разводится номером', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);
  seedPost(app, { title: 'Привет, мир' });

  await app.inject({
    method: 'POST',
    url: '/admin/posts',
    ...post(cookie, { title: 'Привет, мир', slug: '', tags: '', body: 'Другой текст', action: 'draft', _csrf: csrf }),
  });

  assert.ok(app.posts.findBySlug('privet-mir-2'), 'второй слаг получил номер');
  await cleanup();
});

test('запись без заголовка не сохраняется', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);

  const response = await app.inject({
    method: 'POST',
    url: '/admin/posts',
    ...post(cookie, { title: '  ', slug: '', tags: '', body: 'Текст', action: 'draft', _csrf: csrf }),
  });

  assert.equal(response.statusCode, 400);
  assert.ok(response.body.includes('Заголовок'));
  assert.equal(app.posts.listAll().length, 0);
  await cleanup();
});

test('правка меняет текст, разметку и теги', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);
  const existing = seedPost(app, { title: 'Старое', slug: 'staroe', tags: ['Было'] });

  await app.inject({
    method: 'POST',
    url: `/admin/posts/${existing.id}`,
    ...post(cookie, { title: 'Новое', slug: 'staroe', tags: 'Стало', body: '**жирно**', action: 'publish', _csrf: csrf }),
  });

  const updated = app.posts.findById(existing.id);
  assert.equal(updated.title, 'Новое');
  assert.match(updated.body_html, /<strong>жирно<\/strong>/);
  assert.deepEqual(app.tags.forPost(existing.id).map((tag) => tag.name), ['Стало']);
  await cleanup();
});

test('правка без смены адреса не подставляет номер к слагу', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);
  const existing = seedPost(app, { title: 'Заметка', slug: 'zametka' });

  await app.inject({
    method: 'POST',
    url: `/admin/posts/${existing.id}`,
    ...post(cookie, { title: 'Заметка', slug: 'zametka', tags: '', body: 'Другой текст', action: 'draft', _csrf: csrf }),
  });

  // Собственный слаг записи не должен считаться занятым ею же.
  assert.equal(app.posts.findById(existing.id).slug, 'zametka');
  await cleanup();
});

test('удаление убирает запись', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);
  const existing = seedPost(app, { title: 'На удаление', slug: 'na-udalenie' });

  const response = await app.inject({
    method: 'POST',
    url: `/admin/posts/${existing.id}/delete`,
    ...post(cookie, { _csrf: csrf }),
  });

  assert.equal(response.statusCode, 303);
  assert.equal(app.posts.findById(existing.id), undefined);
  await cleanup();
});

test('превью возвращает тот же HTML, что реально сохраняется при публикации', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);
  // В одном исходнике сразу разметка, типографика и вставленный скрипт:
  // сравнение по подстроке пропустило бы подмену разборщика превью на
  // другой, без санитайзера, — здесь так подменить незаметно не выйдет.
  const bodyMd = 'Текст со **сноской** (c) 2026 -- пример... <script>alert(1)</script>';

  const created = await app.inject({
    method: 'POST',
    url: '/admin/posts',
    ...post(cookie, { title: 'Проверка превью', slug: '', tags: '', body: bodyMd, action: 'draft', _csrf: csrf }),
  });
  assert.equal(created.statusCode, 303);
  const id = Number(created.headers.location.match(/\/admin\/posts\/(\d+)\/edit/)[1]);
  const saved = app.posts.findById(id);

  const preview = await app.inject({
    method: 'POST',
    url: '/admin/preview',
    headers: { cookie, 'x-csrf-token': csrf },
    payload: { body: bodyMd },
  });

  assert.equal(preview.statusCode, 200);
  // Убеждаемся, что сравнение вообще что-то различает: в сохранённом теле
  // есть и разметка, и типографика, а скрипт вырезан.
  assert.match(saved.body_html, /<strong>сноской<\/strong>/);
  assert.ok(!saved.body_html.includes('<script>'), 'скрипт должен быть вырезан санитайзером');
  assert.equal(preview.json().html, saved.body_html);
  await cleanup();
});

test('превью без сессии недоступно', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'POST', url: '/admin/preview', payload: { body: 'Текст' } });

  assert.equal(response.statusCode, 303);
  await cleanup();
});

test('список записей без сессии ведёт на форму входа', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/admin' });

  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.location, '/admin/login');
  await cleanup();
});

test('список показывает и черновики, и опубликованные', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie } = await login(app);
  seedPost(app, { title: 'Опубликованная', slug: 'op' });
  seedPost(app, { title: 'Черновик', slug: 'ch', status: 'draft' });

  const all = await app.inject({ method: 'GET', url: '/admin', headers: { cookie } });
  const drafts = await app.inject({ method: 'GET', url: '/admin?status=draft', headers: { cookie } });

  assert.ok(all.body.includes('Опубликованная') && all.body.includes('Черновик'));
  assert.ok(!drafts.body.includes('Опубликованная'));
  await cleanup();
});
