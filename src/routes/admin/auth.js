import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from '../../domain/password.js';
import { createRateLimiter } from '../../plugins/rateLimit.js';

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// A hash of a random password against which a nonexistent user is verified:
// the check costs the same time as a real one, so the response time cannot
// distinguish "no such login" from "wrong password".
// Computed at module load rather than on the first request: otherwise that very
// first request would do two hash computations instead of one and give itself away.
// Exported so a test can check the decoy is ready directly, rather than by timing
// — timing cannot reliably catch a one-off delay.
export const DECOY_PASSWORD_HASH = await hashPassword(randomBytes(32).toString('hex'));

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

    // The password is checked even when no such user exists: otherwise a fast
    // response would reveal that the login doesn't exist, and it could be enumerated.
    const user = app.users.findByUsername(username);
    const correct = await verifyPassword(password, user?.password_hash ?? DECOY_PASSWORD_HASH);

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
