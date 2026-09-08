import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestApp, login } from './helpers/app.js';
import { detectImageType } from '../src/domain/imageType.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function multipart(content, { filename = 'kot.png', contentType = 'image/png' } = {}) {
  const boundary = '----granica-testa';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, content, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

test('определяет тип по сигнатуре, а не по имени', () => {
  assert.deepEqual(detectImageType(PNG), { ext: 'png', mime: 'image/png' });
  assert.equal(detectImageType(Buffer.from('это просто текст')), null);
  assert.equal(detectImageType(Buffer.alloc(0)), null);
});

test('загружает картинку и возвращает готовую разметку', async () => {
  const { app, config, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);
  const body = multipart(PNG);

  const response = await app.inject({
    method: 'POST',
    url: '/admin/upload',
    headers: { cookie, 'x-csrf-token': csrf, 'content-type': body.contentType },
    payload: body.payload,
  });

  assert.equal(response.statusCode, 200);
  const { url, markdown } = response.json();
  assert.match(url, /^\/media\/\d{4}\/\d{2}\/[0-9a-f]{64}\.png$/);
  assert.equal(markdown, `![](${url})`);
  assert.ok(existsSync(join(config.uploadsDir, url.replace('/media/', ''))));
  await cleanup();
});

test('загрузка без ключа CSRF отклоняется, даже с действующей сессией', async () => {
  const { app, config, cleanup } = await createTestApp();
  const { cookie } = await login(app);
  const body = multipart(PNG);

  const response = await app.inject({
    method: 'POST',
    url: '/admin/upload',
    headers: { cookie, 'content-type': body.contentType },
    payload: body.payload,
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(readdirSync(config.uploadsDir, { recursive: true }), [], 'файл не должен был сохраниться');
  await cleanup();
});

test('файл не из белого списка отклоняется', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);
  const body = multipart(Buffer.from('<?php echo 1; ?>'), { filename: 'kot.png' });

  const response = await app.inject({
    method: 'POST',
    url: '/admin/upload',
    headers: { cookie, 'x-csrf-token': csrf, 'content-type': body.contentType },
    payload: body.payload,
  });

  assert.equal(response.statusCode, 415, 'расширение .png не спасает подделку');
  await cleanup();
});

test('загрузка без сессии не проходит', async () => {
  const { app, cleanup } = await createTestApp();
  const body = multipart(PNG);

  const response = await app.inject({
    method: 'POST',
    url: '/admin/upload',
    headers: { 'content-type': body.contentType },
    payload: body.payload,
  });

  assert.equal(response.statusCode, 303);
  await cleanup();
});

test('слишком большой файл отклоняется', async () => {
  const { app, cleanup } = await createTestApp({ UPLOAD_MAX_BYTES: '64' });
  const { cookie, csrf } = await login(app);
  const body = multipart(Buffer.concat([PNG, Buffer.alloc(1024)]));

  const response = await app.inject({
    method: 'POST',
    url: '/admin/upload',
    headers: { cookie, 'x-csrf-token': csrf, 'content-type': body.contentType },
    payload: body.payload,
  });

  assert.equal(response.statusCode, 413);
  // Тело тоже проверяем: без разбора ошибки код 413 придёт и от библиотеки,
  // но с английским текстом.
  assert.equal(response.json().error, 'Файл слишком большой');
  await cleanup();
});

test('при отказе записи на диск наружу не уходит путь сервера', async () => {
  const { app, config, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);
  // Подменяем каталог загрузок файлом: запись внутрь него невозможна на
  // любой машине, включая запуск от root, поэтому проверка устойчива.
  rmSync(config.uploadsDir, { recursive: true, force: true });
  writeFileSync(config.uploadsDir, 'не каталог');
  const body = multipart(PNG);

  const response = await app.inject({
    method: 'POST',
    url: '/admin/upload',
    headers: { cookie, 'x-csrf-token': csrf, 'content-type': body.contentType },
    payload: body.payload,
  });

  assert.equal(response.statusCode, 500);
  assert.equal(response.json().error, 'Не удалось сохранить картинку');
  assert.ok(!response.body.includes('/tmp'), `в ответе путь сервера: ${response.body}`);
  assert.ok(!response.body.includes('EACCES') && !response.body.includes('ENOTDIR'));
  await cleanup();
});

test('загруженный файл отдаётся по /media', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);
  const body = multipart(PNG);
  const upload = await app.inject({
    method: 'POST',
    url: '/admin/upload',
    headers: { cookie, 'x-csrf-token': csrf, 'content-type': body.contentType },
    payload: body.payload,
  });

  const response = await app.inject({ method: 'GET', url: upload.json().url });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /image\/png/);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  await cleanup();
});
