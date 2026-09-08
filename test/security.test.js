import test from 'node:test';
import assert from 'node:assert/strict';
import { unsign } from '@fastify/cookie';
import { createTestApp, login, csrfFromLoginPage, TEST_USER } from './helpers/app.js';
import { hashPassword } from '../src/domain/password.js';

test('на каждый ответ ставятся заголовки безопасности', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/' });

  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.match(response.headers['content-security-policy'], /script-src 'self'/);
  assert.match(response.headers['content-security-policy'], /frame-ancestors 'none'/);
  await cleanup();
});

test('первый запрос выдаёт ключ CSRF в cookie, ключ подписан', async () => {
  const { app, config, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/' });

  const csrf = response.cookies.find((cookie) => cookie.name === 'csrf');
  assert.ok(csrf, 'cookie csrf не выставлена');
  assert.equal(csrf.httpOnly, true);
  assert.equal(csrf.sameSite, 'Lax');

  // The key is signed with the same secret as the session cookie: the cookie value is
  // not the key itself, but a signature over it — otherwise forging the cookie by a neighboring
  // subdomain would be indistinguishable from the real key.
  const unsigned = unsign(csrf.value, config.sessionSecret);
  assert.equal(unsigned.valid, true, 'подпись ключа CSRF не сходится');
  assert.equal(unsigned.value.length, 64);
  await cleanup();
});

test('испорченный ключ CSRF не проходит подпись и блокирует запись', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);
  // We swap a couple of characters in the signed cookie value — as if a
  // neighbor who doesn't know the signing secret had forged it.
  const brokenCookie = cookie.replace(/(csrf=)([^;]+)/, (_, prefix, value) => {
    const chars = value.split('');
    const middle = Math.floor(chars.length / 2);
    chars[middle] = chars[middle] === 'a' ? 'b' : 'a';
    chars[middle + 1] = chars[middle + 1] === 'a' ? 'b' : 'a';
    return prefix + chars.join('');
  });

  const response = await app.inject({
    method: 'POST',
    url: '/admin/posts',
    headers: { cookie: brokenCookie, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ title: 'Подделка', slug: '', tags: '', body: 'Текст', action: 'draft', _csrf: csrf }).toString(),
  });

  assert.equal(response.statusCode, 403);
  await cleanup();
});

test('сессионная cookie недоступна скрипту и не уходит на чужой сайт', async () => {
  const { app, cleanup } = await createTestApp();
  app.users.create(TEST_USER.username, await hashPassword(TEST_USER.password));
  const page = await app.inject({ method: 'GET', url: '/admin/login' });
  const { cookie: csrfCookie, token: csrf } = csrfFromLoginPage(page);

  const response = await app.inject({
    method: 'POST',
    url: '/admin/login',
    headers: { cookie: `csrf=${csrfCookie}`, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({
      username: TEST_USER.username,
      password: TEST_USER.password,
      _csrf: csrf,
    }).toString(),
  });

  const sid = response.cookies.find((cookie) => cookie.name === 'sid');
  assert.ok(sid, 'cookie sid не выставлена');
  assert.equal(sid.httpOnly, true);
  assert.equal(sid.sameSite, 'Lax');
  await cleanup();
});

test('анонимный запрос не получает ключа сессии', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/' });

  assert.equal(response.cookies.find((cookie) => cookie.name === 'sid'), undefined);
  await cleanup();
});

test('необработанная ошибка от JSON-запроса отдаёт русский текст, без подробностей библиотеки', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/media/' });

  assert.equal(response.statusCode, 403);
  const body = response.json();
  assert.ok(!body.error.includes('Forbidden'), `в ответе текст библиотеки: ${response.body}`);
  assert.match(body.error, /[а-яё]/i);
  await cleanup();
});

test('необработанная ошибка от перехода по ссылке отдаёт страницу на русском', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/media/', headers: { accept: 'text/html' } });

  assert.equal(response.statusCode, 403);
  assert.match(response.headers['content-type'], /text\/html/);
  assert.ok(!response.body.includes('Forbidden'), `в ответе текст библиотеки: ${response.body}`);
  assert.match(response.body, /[а-яё]/i);
  await cleanup();
});
