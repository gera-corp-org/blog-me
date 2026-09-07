import { loadConfig } from '../../src/config.js';
import { buildServer } from '../../src/server.js';
import { renderMarkdown } from '../../src/domain/markdown.js';
import { makeExcerpt } from '../../src/domain/excerpt.js';
import { slugify } from '../../src/domain/slug.js';
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
