import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createUserRepository } from '../db/users.js';
import { createSessionRepository } from '../db/sessions.js';

const SESSION_COOKIE = 'sid';
const CSRF_COOKIE = 'csrf';

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

    let token = request.cookies[CSRF_COOKIE];
    if (!token) {
      token = randomBytes(32).toString('hex');
      reply.setCookie(CSRF_COOKIE, token, cookieOptions);
    }
    request.csrfToken = token;
  });

  app.decorate('requireAuth', async (request, reply) => {
    if (!request.user) return reply.redirect('/admin/login', 303);
  });

  app.decorate('verifyCsrf', async (request, reply) => {
    const expected = request.cookies[CSRF_COOKIE];
    const provided = request.body?._csrf ?? request.headers['x-csrf-token'];
    if (!expected || !provided || !safeEqual(provided, expected)) {
      return reply.code(403).view('403.eta', { pageTitle: 'Запрос отклонён', user: request.user });
    }
  });
}

export default fp(authPlugin, { name: 'auth' });
