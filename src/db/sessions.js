import { randomBytes } from 'node:crypto';
import { createStatementCache } from './statements.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function createSessionRepository(db) {
  const sql = createStatementCache(db);

  return {
    create(userId, ttlDays) {
      const id = randomBytes(32).toString('hex');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlDays * DAY_MS);
      sql('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
        .run(id, userId, now.toISOString(), expiresAt.toISOString());
      return { id, expiresAt };
    },

    find(id) {
      if (!id) return undefined;
      return sql(`SELECT s.id, s.user_id, s.expires_at, u.username
                  FROM sessions s JOIN users u ON u.id = s.user_id
                  WHERE s.id = ? AND s.expires_at > ?`).get(id, new Date().toISOString());
    },

    destroy(id) {
      return sql('DELETE FROM sessions WHERE id = ?').run(id).changes;
    },

    destroyForUser(userId) {
      return sql('DELETE FROM sessions WHERE user_id = ?').run(userId).changes;
    },

    purgeExpired() {
      return sql('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString()).changes;
    },
  };
}
