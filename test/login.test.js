import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, login, form, TEST_USER } from './helpers/app.js';
import { hashPassword } from '../src/domain/password.js';
import { ensureAdminUser } from '../src/bootstrap.js';

test('вход с верным паролем выдаёт сессию', async () => {
  const { app, cleanup } = await createTestApp();

  const { cookie } = await login(app);
  const response = await app.inject({ method: 'GET', url: '/admin/login', headers: { cookie } });

  assert.equal(response.statusCode, 303, 'вошедшего форма входа уводит в админку');
  assert.equal(response.headers.location, '/admin');
  await cleanup();
});

test('неверный пароль не создаёт сессию', async () => {
  const { app, cleanup } = await createTestApp();
  app.users.create(TEST_USER.username, await hashPassword(TEST_USER.password));
  const page = await app.inject({ method: 'GET', url: '/admin/login' });
  const csrf = page.cookies.find((cookie) => cookie.name === 'csrf').value;

  const response = await app.inject({
    method: 'POST',
    url: '/admin/login',
    headers: { cookie: `csrf=${csrf}`, ...form({}).headers },
    payload: new URLSearchParams({ username: TEST_USER.username, password: 'не тот', _csrf: csrf }).toString(),
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.cookies.find((cookie) => cookie.name === 'sid'), undefined);
  await cleanup();
});

test('вход без ключа CSRF отклоняется', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({
    method: 'POST',
    url: '/admin/login',
    ...form({ username: TEST_USER.username, password: TEST_USER.password }),
  });

  assert.equal(response.statusCode, 403);
  await cleanup();
});

test('после десяти неудач вход отвечает 429', async () => {
  const { app, cleanup } = await createTestApp();
  app.users.create(TEST_USER.username, await hashPassword(TEST_USER.password));
  const page = await app.inject({ method: 'GET', url: '/admin/login' });
  const csrf = page.cookies.find((cookie) => cookie.name === 'csrf').value;
  const attempt = () => app.inject({
    method: 'POST',
    url: '/admin/login',
    headers: { cookie: `csrf=${csrf}`, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ username: TEST_USER.username, password: 'не тот', _csrf: csrf }).toString(),
  });

  for (let index = 0; index < 10; index += 1) {
    assert.equal((await attempt()).statusCode, 401);
  }

  assert.equal((await attempt()).statusCode, 429);
  await cleanup();
});

test('время ответа не выдаёт, существует ли логин', async () => {
  const { app, cleanup } = await createTestApp();
  app.users.create(TEST_USER.username, await hashPassword(TEST_USER.password));
  const page = await app.inject({ method: 'GET', url: '/admin/login' });
  const csrf = page.cookies.find((cookie) => cookie.name === 'csrf').value;
  const attempt = (username) => app.inject({
    method: 'POST',
    url: '/admin/login',
    headers: { cookie: `csrf=${csrf}`, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ username, password: 'не тот', _csrf: csrf }).toString(),
  });

  const started = process.hrtime.bigint();
  await attempt('никакого-такого-логина-нет');
  const unknownMs = Number(process.hrtime.bigint() - started) / 1e6;

  // Проверка пароля занимает десятки миллисекунд. Быстрый ответ означал бы,
  // что для несуществующего логина её пропустили.
  assert.ok(unknownMs > 5, `ответ пришёл за ${unknownMs.toFixed(1)} мс — проверку пропустили`);
  await cleanup();
});

test('без сессии закрытый маршрут ведёт на форму входа', async () => {
  const { app, cleanup } = await createTestApp();

  const response = await app.inject({ method: 'POST', url: '/admin/logout' });

  assert.equal(response.statusCode, 303, 'проверка сессии идёт раньше проверки CSRF');
  assert.equal(response.headers.location, '/admin/login');
  await cleanup();
});

test('выход закрывает сессию', async () => {
  const { app, cleanup } = await createTestApp();
  const { cookie, csrf } = await login(app);

  const logout = await app.inject({
    method: 'POST',
    url: '/admin/logout',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ _csrf: csrf }).toString(),
  });
  const after = await app.inject({ method: 'GET', url: '/admin/login', headers: { cookie } });

  assert.equal(logout.statusCode, 303);
  assert.equal(after.statusCode, 200, 'сессия больше не действует: форма входа снова открыта');
  await cleanup();
});

test('первый пользователь создаётся из окружения ровно один раз', async () => {
  const { app, config, cleanup } = await createTestApp();
  const withAdmin = { ...config, adminUsername: 'gera', adminPassword: 'пароль12345' };

  assert.equal(await ensureAdminUser({ users: app.users, config: withAdmin }), true);
  assert.equal(await ensureAdminUser({ users: app.users, config: withAdmin }), false);
  assert.equal(app.users.count(), 1);
  await cleanup();
});
