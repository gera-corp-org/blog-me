import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createUserRepository } from '../db/users.js';
import { createSessionRepository } from '../db/sessions.js';

const SESSION_COOKIE = 'sid';
const CSRF_COOKIE = 'csrf';

// The token is needed only where forms are rendered. Static files, images and
// health probes are skipped: their responses are cached for a long time, and a
// shared cache could hand out someone else's token to every reader.
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

    // Admin pages must never be cached: the HTML embeds a CSRF token that must
    // stay in sync with the csrf cookie. A shared cache (Cloudflare, CDN) can
    // serve stale HTML with an old token while the cookie is fresh → 403.
    if (request.url.startsWith('/admin')) {
      reply.header('Cache-Control', 'no-store');
    }

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
      // The editor sends previews and image uploads via script and expects JSON;
      // a person with a form needs a page.
      if ((request.headers.accept ?? '').includes('text/html')) {
        return reply.code(403).view('403.eta', { pageTitle: 'Запрос отклонён', user: request.user });
      }
      return reply.code(403).send({ error: 'Запрос отклонён' });
    }
  });
}

export default fp(authPlugin, { name: 'auth' });
