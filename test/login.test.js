import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, login, form, TEST_USER, csrfFromLoginPage } from './helpers/app.js';
import { DECOY_PASSWORD_HASH } from '../src/routes/admin/auth.js';
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
  const { cookie: csrfCookie, token: csrf } = csrfFromLoginPage(page);

  const response = await app.inject({
    method: 'POST',
    url: '/admin/login',
    headers: { cookie: `csrf=${csrfCookie}`, ...form({}).headers },
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
  const { cookie: csrfCookie, token: csrf } = csrfFromLoginPage(page);
  const attempt = () => app.inject({
    method: 'POST',
    url: '/admin/login',
    headers: { cookie: `csrf=${csrfCookie}`, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ username: TEST_USER.username, password: 'не тот', _csrf: csrf }).toString(),
  });

  for (let index = 0; index < 10; index += 1) {
    assert.equal((await attempt()).statusCode, 401);
  }

  assert.equal((await attempt()).statusCode, 429);
  await cleanup();
});

test('заголовку доверенного прокси верят: попытки считаются по разным адресам', async () => {
  // The default trusts loopback, and in tests the connection peer is 127.0.0.1.
  // So the header is accepted, and eleven attempts from eleven
  // different addresses must not hit a limit meant for one.
  const { app, cleanup } = await createTestApp();
  app.users.create(TEST_USER.username, await hashPassword(TEST_USER.password));
  const page = await app.inject({ method: 'GET', url: '/admin/login' });
  const { cookie: csrfCookie, token: csrf } = csrfFromLoginPage(page);
  const codes = [];

  for (let index = 1; index <= 11; index += 1) {
    const response = await app.inject({
      method: 'POST',
      url: '/admin/login',
      headers: {
        cookie: `csrf=${csrfCookie}`,
        'content-type': 'application/x-www-form-urlencoded',
        'x-forwarded-for': `203.0.113.${index}`,
      },
      payload: new URLSearchParams({ username: TEST_USER.username, password: 'не тот', _csrf: csrf }).toString(),
    });
    codes.push(response.statusCode);
  }

  assert.ok(!codes.includes(429), `предел сработал на разных адресах: ${codes.join(',')}`);
  await cleanup();
});

test('заголовку от недоверенного клиента не верят: подделка адреса не обходит предел', async () => {
  // Here a foreign network is declared trusted, so 127.0.0.1 is untrusted and
  // its header is ignored — all attempts count as a single client.
  const { app, cleanup } = await createTestApp({ TRUST_PROXY: '10.0.0.0/8' });
  app.users.create(TEST_USER.username, await hashPassword(TEST_USER.password));
  const page = await app.inject({ method: 'GET', url: '/admin/login' });
  const { cookie: csrfCookie, token: csrf } = csrfFromLoginPage(page);
  const codes = [];

  for (let index = 1; index <= 11; index += 1) {
    const response = await app.inject({
      method: 'POST',
      url: '/admin/login',
      headers: {
        cookie: `csrf=${csrfCookie}`,
        'content-type': 'application/x-www-form-urlencoded',
        'x-forwarded-for': `203.0.113.${index}`,
      },
      payload: new URLSearchParams({ username: TEST_USER.username, password: 'не тот', _csrf: csrf }).toString(),
    });
    codes.push(response.statusCode);
  }

  assert.equal(codes[10], 429, `подделка адреса обошла предел: ${codes.join(',')}`);
  await cleanup();
});

test('приманка готова до первого запроса', () => {
  // A direct check instead of timing: if the dummy hash is computed lazily, the first
  // login with a nonexistent username does two hash computations and turns out
  // twice as slow — and timings don't catch a one-off delay.
  assert.match(DECOY_PASSWORD_HASH, /^scrypt\$\d+\$\d+\$\d+\$/);
});

test('в установившемся режиме время ответа не зависит от существования логина', async () => {
  const { app, cleanup } = await createTestApp();
  app.users.create(TEST_USER.username, await hashPassword(TEST_USER.password));
  const page = await app.inject({ method: 'GET', url: '/admin/login' });
  const { cookie: csrfCookie, token: csrf } = csrfFromLoginPage(page);
  const attempt = (username) => app.inject({
    method: 'POST',
    url: '/admin/login',
    headers: { cookie: `csrf=${csrfCookie}`, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ username, password: 'не тот', _csrf: csrf }).toString(),
  });

  // The smallest of three measurements: the minimum is more robust than the mean against random
  // scheduler delays.
  const measure = async (username) => {
    const runs = [];
    for (let index = 0; index < 3; index += 1) {
      const started = process.hrtime.bigint();
      await attempt(username);
      runs.push(Number(process.hrtime.bigint() - started) / 1e6);
    }
    return Math.min(...runs);
  };

  const known = await measure(TEST_USER.username);
  const unknown = await measure('никакого-такого-логина-нет');
  const ratio = unknown / known;

  // We compare against a baseline, not an absolute threshold: a threshold would catch
  // only a complete skip of the check, but would miss a 1.5x leak.
  assert.ok(
    ratio > 0.5 && ratio < 2,
    `ответы отличаются в ${ratio.toFixed(2)} раза (${known.toFixed(1)} мс против ${unknown.toFixed(1)} мс)`,
  );
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
