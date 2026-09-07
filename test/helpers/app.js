import { loadConfig } from '../../src/config.js';
import { buildServer } from '../../src/server.js';
import { renderMarkdown } from '../../src/domain/markdown.js';
import { makeExcerpt } from '../../src/domain/excerpt.js';
import { slugify } from '../../src/domain/slug.js';
import { hashPassword } from '../../src/domain/password.js';
import { createTestDatabase } from './db.js';

export async function createTestApp(env = {}) {
  const { db, dir, cleanup } = createTestDatabase();
  const config = loadConfig({ COOKIE_SECURE: 'false', DATA_DIR: dir, ...env });
  const app = buildServer({ config, db });
  await app.ready();

  return {
    app,
    db,
    config,
    dir,
    async cleanup() {
      await app.close();
      cleanup();
    },
  };
}

export function seedPost(app, { title = 'Запись', body = 'Текст записи', status = 'published', tags = [], slug } = {}) {
  const html = renderMarkdown(body);
  const post = app.posts.create({
    slug: slug ?? slugify(title),
    title,
    bodyMd: body,
    bodyHtml: html,
    excerpt: makeExcerpt(html),
    status,
  });
  if (tags.length > 0) app.tags.setForPost(post.id, tags);
  return post;
}

export const TEST_USER = { username: 'gera', password: 'пароль12345' };

export async function login(app, credentials = TEST_USER) {
  if (!app.users.findByUsername(credentials.username)) {
    app.users.create(credentials.username, await hashPassword(credentials.password));
  }

  const page = await app.inject({ method: 'GET', url: '/admin/login' });
  const csrf = page.cookies.find((cookie) => cookie.name === 'csrf').value;

  const response = await app.inject({
    method: 'POST',
    url: '/admin/login',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: `csrf=${csrf}`,
    },
    payload: new URLSearchParams({
      username: credentials.username,
      password: credentials.password,
      _csrf: csrf,
    }).toString(),
  });

  const session = response.cookies.find((cookie) => cookie.name === 'sid');
  if (!session) throw new Error(`вход не удался: ${response.statusCode}`);

  return { cookie: `sid=${session.value}; csrf=${csrf}`, csrf };
}

export function form(fields) {
  return {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams(fields).toString(),
  };
}
