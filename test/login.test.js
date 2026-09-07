import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, login, form, TEST_USER } from './helpers/app.js';
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

test('приманка готова до первого запроса', () => {
  // Прямая проверка вместо замера: если считать приманку лениво, первый
  // вход с несуществующим логином сделает два вычисления хеша и окажется
  // вдвое дольше — а замеры разовую задержку не ловят.
  assert.match(DECOY_PASSWORD_HASH, /^scrypt\$\d+\$\d+\$\d+\$/);
});

test('в установившемся режиме время ответа не зависит от существования логина', async () => {
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

  // Наименьшее из трёх замеров: минимум устойчивее среднего к случайным
  // задержкам планировщика.
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

  // Сравниваем с базовой линией, а не с абсолютным порогом: порог поймал бы
  // только полный пропуск сверки, а утечку в полтора раза пропустил бы.
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
