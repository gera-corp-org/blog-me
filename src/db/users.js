import { createStatementCache } from './statements.js';

export function createUserRepository(db) {
  const sql = createStatementCache(db);

  return {
    create(username, passwordHash) {
      return sql(`INSERT INTO users (username, password_hash, created_at)
                  VALUES (?, ?, ?)
                  RETURNING id, username, password_hash, created_at`)
        .get(username, passwordHash, new Date().toISOString());
    },

    findByUsername(username) {
      return sql('SELECT id, username, password_hash, created_at FROM users WHERE username = ?').get(username);
    },

    findById(id) {
      return sql('SELECT id, username, password_hash, created_at FROM users WHERE id = ?').get(id);
    },

    count() {
      return sql('SELECT COUNT(*) AS total FROM users').get().total;
    },

    updatePassword(id, passwordHash) {
      return sql('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id).changes;
    },
  };
}
