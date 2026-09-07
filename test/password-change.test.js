import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, login, TEST_USER } from './helpers/app.js';
import { verifyPassword } from '../src/domain/password.js';

const submit = (cookie, csrf, fields) => ({
  headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
  payload: new URLSearchParams({ ...fields, _csrf: csrf }).toString(),
});

test('меняет пароль и закрывает прочие сессии', async () => {
  const { app, cleanup } = await createTestApp();
  const first = await login(app);
  const second = await login(app);

  const response = await app.inject({
    method: 'POST',
    url: '/admin/password',
    ...submit(second.cookie, second.csrf, {
      current: TEST_USER.password,
      next: 'новыйпароль123',
      repeat: 'новыйпароль123',
    }),
  });

  assert.equal(response.statusCode, 200);
  const user = app.users.findByUsername(TEST_USER.username);
  assert.equal(await verifyPassword('новыйпароль123', user.password_hash), true);

  const oldSession = await app.inject({ method: 'GET', url: '/admin', headers: { cookie: first.cookie } });
  assert.equal(oldSession.statusCode, 303, 'старая сессия закрыта');

  // Вторая половина требования: та вкладка, откуда меняли пароль, обязана
  // остаться внутри. Без этой проверки можно убрать выдачу новой сессии, и
  // тест останется зелёным.
  const refreshed = response.cookies.find((cookie) => cookie.name === 'sid');
  assert.ok(refreshed, 'новая сессия не выдана');
  const stillInside = await app.inject({
    method: 'GET',
    url: '/admin',
    headers: { cookie: `sid=${refreshed.value}; csrf=${second.csrf}` },
  });
  assert.equal(stillInside.statusCode, 200, 'текущая вкладка выпала из админки');
  await cleanup();
});

test('не меняет пароль при неверном текущем', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);

  const response = await app.inject({
    method: 'POST',
    url: '/admin/password',
    ...submit(cookie, csrf, { current: 'не тот', next: 'новыйпароль123', repeat: 'новыйпароль123' }),
  });

  assert.equal(response.statusCode, 400);
  const user = app.users.findByUsername(TEST_USER.username);
  assert.equal(await verifyPassword(TEST_USER.password, user.password_hash), true);
  await cleanup();
});

test('требует совпадения и длины нового пароля', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);

  const mismatch = await app.inject({
    method: 'POST',
    url: '/admin/password',
    ...submit(cookie, csrf, { current: TEST_USER.password, next: 'новыйпароль123', repeat: 'другой' }),
  });
  const tooShort = await app.inject({
    method: 'POST',
    url: '/admin/password',
    ...submit(cookie, csrf, { current: TEST_USER.password, next: 'коротко', repeat: 'коротко' }),
  });

  assert.equal(mismatch.statusCode, 400);
  assert.equal(tooShort.statusCode, 400);
  await cleanup();
});

test('без сессии страница смены пароля недоступна', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'GET', url: '/admin/password' });

  assert.equal(response.statusCode, 303);
  await cleanup();
});
