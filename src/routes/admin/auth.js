import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from '../../domain/password.js';
import { createRateLimiter } from '../../plugins/rateLimit.js';

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Хеш случайного пароля, с которым сверяется несуществующий пользователь:
// сверка стоит столько же времени, сколько настоящая, и по длительности
// ответа нельзя отличить «нет такого логина» от «неверный пароль».
let decoy;
async function decoyHash() {
  decoy ??= await hashPassword(randomBytes(32).toString('hex'));
  return decoy;
}

export async function adminAuthRoutes(app) {
  const limiter = createRateLimiter({ limit: LOGIN_LIMIT, windowMs: LOGIN_WINDOW_MS });

  const loginPage = (request, reply, { code = 200, error = null, username = '' } = {}) =>
    reply.code(code).view('admin/login.eta', {
      pageTitle: 'Вход',
      csrf: request.csrfToken,
      user: null,
      error,
      username,
    });

  app.get('/admin/login', async (request, reply) => {
    if (request.user) return reply.redirect('/admin', 303);
    return loginPage(request, reply);
  });

  app.post('/admin/login', { preHandler: app.verifyCsrf }, async (request, reply) => {
    const username = String(request.body?.username ?? '').trim();
    const password = String(request.body?.password ?? '');

    if (!limiter.check(request.ip)) {
      return loginPage(request, reply, {
        code: 429,
        error: 'Слишком много попыток. Подождите четверть часа.',
        username,
      });
    }

    // Пароль проверяется даже когда такого пользователя нет: иначе быстрый
    // ответ выдаёт, что логин не существует, и его можно перебрать.
    const user = app.users.findByUsername(username);
    const correct = await verifyPassword(password, user?.password_hash ?? (await decoyHash()));

    if (!user || !correct) {
      return loginPage(request, reply, {
        code: 401,
        error: 'Неверный логин или пароль.',
        username,
      });
    }

    limiter.reset(request.ip);
    app.startSession(reply, user.id);
    return reply.redirect('/admin', 303);
  });

  app.post('/admin/logout', { preHandler: [app.requireAuth, app.verifyCsrf] }, async (request, reply) => {
    app.endSession(request, reply);
    return reply.redirect('/', 303);
  });
}
