import { slugify } from '../domain/slug.js';
import { createStatementCache } from './statements.js';

export function parseTagInput(input) {
  const bySlug = new Map();
  for (const name of String(input ?? '').split(',')) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const slug = slugify(trimmed);
    if (!bySlug.has(slug)) bySlug.set(slug, trimmed);
  }
  return [...bySlug.values()];
}

export function createTagRepository(db) {
  const sql = createStatementCache(db);

  const setForPost = db.transaction((postId, names) => {
    sql('DELETE FROM post_tags WHERE post_id = ?').run(postId);
    for (const name of names) {
      const tag = sql(`INSERT INTO tags (name, slug) VALUES (?, ?)
                       ON CONFLICT (slug) DO UPDATE SET name = excluded.name
                       RETURNING id`).get(name, slugify(name));
      sql('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)').run(postId, tag.id);
    }
    sql('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM post_tags)').run();
  });

  return {
    setForPost,

    forPost(postId) {
      return sql(`SELECT t.id, t.name, t.slug FROM tags t
                  JOIN post_tags pt ON pt.tag_id = t.id
                  WHERE pt.post_id = ? ORDER BY t.name`).all(postId);
    },

    forPosts(ids) {
      const grouped = new Map(ids.map((id) => [id, []]));
      if (ids.length === 0) return grouped;
      const rows = sql(`SELECT pt.post_id, t.id, t.name, t.slug FROM tags t
                        JOIN post_tags pt ON pt.tag_id = t.id
                        WHERE pt.post_id IN (SELECT value FROM json_each(?))
                        ORDER BY t.name`).all(JSON.stringify(ids));
      for (const row of rows) {
        grouped.get(row.post_id).push({ id: row.id, name: row.name, slug: row.slug });
      }
      return grouped;
    },

    findBySlug(slug) {
      return sql('SELECT id, name, slug FROM tags WHERE slug = ?').get(slug);
    },

    listUsed() {
      return sql(`SELECT t.id, t.name, t.slug, COUNT(*) AS count FROM tags t
                  JOIN post_tags pt ON pt.tag_id = t.id
                  JOIN posts p ON p.id = pt.post_id
                  WHERE p.status = 'published'
                  GROUP BY t.id ORDER BY t.name`).all();
    },
  };
}
