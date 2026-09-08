import { createStatementCache } from './statements.js';

const COLUMNS = 'id, slug, title, body_md, body_html, excerpt, status, created_at, updated_at, published_at';
const PREFIXED = COLUMNS.split(', ').map((column) => `p.${column}`).join(', ');

function publishedAtFor(status, previous, now) {
  if (status !== 'published') return previous ?? null;
  return previous ?? now;
}

export function createPostRepository(db) {
  const sql = createStatementCache(db);

  return {
    create({ slug, title, bodyMd, bodyHtml, excerpt, status }) {
      const now = new Date().toISOString();
      return sql(`INSERT INTO posts (slug, title, body_md, body_html, excerpt, status, created_at, updated_at, published_at)
                  VALUES (@slug, @title, @bodyMd, @bodyHtml, @excerpt, @status, @now, @now, @publishedAt)
                  RETURNING ${COLUMNS}`)
        .get({
          slug, title, bodyMd, bodyHtml, excerpt, status, now,
          publishedAt: publishedAtFor(status, null, now),
        });
    },

    update(id, { slug, title, bodyMd, bodyHtml, excerpt, status }) {
      const existing = this.findById(id);
      if (!existing) return undefined;
      const now = new Date().toISOString();
      return sql(`UPDATE posts SET slug = @slug, title = @title, body_md = @bodyMd,
                    body_html = @bodyHtml, excerpt = @excerpt, status = @status,
                    updated_at = @now, published_at = @publishedAt
                  WHERE id = @id
                  RETURNING ${COLUMNS}`)
        .get({
          id, slug, title, bodyMd, bodyHtml, excerpt, status, now,
          publishedAt: publishedAtFor(status, existing.published_at, now),
        });
    },

    remove(id) {
      return sql('DELETE FROM posts WHERE id = ?').run(id).changes;
    },

    findById(id) {
      return sql(`SELECT ${COLUMNS} FROM posts WHERE id = ?`).get(id);
    },

    findBySlug(slug) {
      return sql(`SELECT ${COLUMNS} FROM posts WHERE slug = ?`).get(slug);
    },

    slugExists(slug, exceptId = null) {
      const row = sql('SELECT 1 AS found FROM posts WHERE slug = ? AND (? IS NULL OR id <> ?)')
        .get(slug, exceptId, exceptId);
      return row !== undefined;
    },

    listPublished({ limit, offset }) {
      return sql(`SELECT ${COLUMNS} FROM posts WHERE status = 'published'
                  ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?`).all(limit, offset);
    },

    countPublished() {
      return sql(`SELECT COUNT(*) AS total FROM posts WHERE status = 'published'`).get().total;
    },

    listAll(status = null) {
      return sql(`SELECT ${COLUMNS} FROM posts WHERE (? IS NULL OR status = ?)
                  ORDER BY COALESCE(published_at, updated_at) DESC, id DESC`).all(status, status);
    },

    listByTag(tagSlug, { limit, offset }) {
      return sql(`SELECT ${PREFIXED} FROM posts p
                  JOIN post_tags pt ON pt.post_id = p.id
                  JOIN tags t ON t.id = pt.tag_id
                  WHERE t.slug = ? AND p.status = 'published'
                  ORDER BY p.published_at DESC, p.id DESC LIMIT ? OFFSET ?`).all(tagSlug, limit, offset);
    },

    countByTag(tagSlug) {
      return sql(`SELECT COUNT(*) AS total FROM posts p
                  JOIN post_tags pt ON pt.post_id = p.id
                  JOIN tags t ON t.id = pt.tag_id
                  WHERE t.slug = ? AND p.status = 'published'`).get(tagSlug).total;
    },

    search(match, { limit }) {
      if (!match) return [];
      return sql(`SELECT ${PREFIXED} FROM posts p
                  JOIN posts_fts ON posts_fts.rowid = p.id
                  WHERE posts_fts MATCH ? AND p.status = 'published'
                  ORDER BY rank, p.id DESC LIMIT ?`).all(match, limit);
    },
  };
}
