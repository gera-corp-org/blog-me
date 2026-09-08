import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createUserRepository } from '../db/users.js';
import { createSessionRepository } from '../db/sessions.js';

const SESSION_COOKIE = 'sid';
const CSRF_COOKIE = 'csrf';

// Ключ нужен только там, где рисуются формы. Статику, картинки и пробы
// пропускаем: их ответы кешируются надолго, и общий кеш вправе раздать
// один чужой ключ всем читателям.
const CSRF_SKIP = ['/static/', '/media/', '/healthz', '/readyz'];

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

async function authPlugin(app) {
  const { config } = app;
  await app.register(cookie, { secret: config.sessionSecret });

  app.decorate('users', createUserRepository(app.db));
  app.decorate('sessions', createSessionRepository(app.db));
  app.decorateRequest('user', null);
  app.decorateRequest('csrfToken', null);

  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
  };

  app.decorate('startSession', (reply, userId) => {
    const session = app.sessions.create(userId, config.sessionTtlDays);
    reply.setCookie(SESSION_COOKIE, session.id, {
      ...cookieOptions,
      signed: true,
      expires: session.expiresAt,
    });
    return session;
  });

  app.decorate('endSession', (request, reply) => {
    const raw = request.cookies[SESSION_COOKIE];
    if (raw) {
      const unsigned = request.unsignCookie(raw);
      if (unsigned.valid) app.sessions.destroy(unsigned.value);
    }
    reply.clearCookie(SESSION_COOKIE, cookieOptions);
  });

  app.addHook('onRequest', async (request, reply) => {
    const raw = request.cookies[SESSION_COOKIE];
    if (raw) {
      const unsigned = request.unsignCookie(raw);
      if (unsigned.valid) {
        const session = app.sessions.find(unsigned.value);
        if (session) request.user = { id: session.user_id, username: session.username };
      }
    }

    if (CSRF_SKIP.some((prefix) => request.url.startsWith(prefix))) return;

    const rawCsrf = request.cookies[CSRF_COOKIE];
    const unsignedCsrf = rawCsrf ? request.unsignCookie(rawCsrf) : { valid: false };
    if (unsignedCsrf.valid) {
      request.csrfToken = unsignedCsrf.value;
      return;
    }

    const token = randomBytes(32).toString('hex');
    reply.setCookie(CSRF_COOKIE, token, { ...cookieOptions, signed: true });
    request.csrfToken = token;
  });

  app.decorate('requireAuth', async (request, reply) => {
    if (!request.user) return reply.redirect('/admin/login', 303);
  });

  app.decorate('verifyCsrf', async (request, reply) => {
    const raw = request.cookies[CSRF_COOKIE];
    const unsigned = raw ? request.unsignCookie(raw) : { valid: false };
    const provided = request.body?._csrf ?? request.headers['x-csrf-token'];

    if (!unsigned.valid || !provided || !safeEqual(provided, unsigned.value)) {
      // Редактор шлёт превью и загрузку картинок скриптом и ждёт JSON;
      // человеку с формой нужна страница.
      if ((request.headers.accept ?? '').includes('text/html')) {
        return reply.code(403).view('403.eta', { pageTitle: 'Запрос отклонён', user: request.user });
      }
      return reply.code(403).send({ error: 'Запрос отклонён' });
    }
  });
}

export default fp(authPlugin, { name: 'auth' });
