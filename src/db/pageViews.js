import { createStatementCache } from './statements.js';

export function createPageViewRepository(db) {
  const sql = createStatementCache(db);

  return {
    increment(path) {
      sql(`INSERT INTO page_views (path, views) VALUES (?, 1)
           ON CONFLICT(path) DO UPDATE SET views = views + 1`).run(path);
    },

    total() {
      return sql('SELECT COALESCE(SUM(views), 0) AS total FROM page_views').get().total;
    },

    byPath(path) {
      const row = sql('SELECT views FROM page_views WHERE path = ?').get(path);
      return row ? row.views : 0;
    },

    list() {
      return sql('SELECT path, views FROM page_views ORDER BY views DESC, path ASC').all();
    },
  };
}
