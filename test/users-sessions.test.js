import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from './helpers/db.js';
import { createUserRepository } from '../src/db/users.js';
import { createSessionRepository } from '../src/db/sessions.js';

test('создаёт и находит пользователя', () => {
  const { db, cleanup } = createTestDatabase();
  const users = createUserRepository(db);

  assert.equal(users.count(), 0);
  const created = users.create('gera', 'хеш');

  assert.equal(users.count(), 1);
  assert.equal(users.findByUsername('gera').password_hash, 'хеш');
  assert.equal(users.findById(created.id).username, 'gera');
  assert.equal(users.findByUsername('никто'), undefined);
  cleanup();
});

test('меняет пароль', () => {
  const { db, cleanup } = createTestDatabase();
  const users = createUserRepository(db);
  const user = users.create('gera', 'старый');

  users.updatePassword(user.id, 'новый');

  assert.equal(users.findById(user.id).password_hash, 'новый');
  cleanup();
});

test('сессия находится по ключу и содержит имя пользователя', () => {
  const { db, cleanup } = createTestDatabase();
  const users = createUserRepository(db);
  const sessions = createSessionRepository(db);
  const user = users.create('gera', 'хеш');

  const session = sessions.create(user.id, 30);
  const found = sessions.find(session.id);

  assert.equal(found.user_id, user.id);
  assert.equal(found.username, 'gera');
  assert.equal(session.id.length, 64, 'ключ сессии — 32 случайных байта в hex');
  cleanup();
});

test('просроченная сессия не находится и вычищается', () => {
  const { db, cleanup } = createTestDatabase();
  const users = createUserRepository(db);
  const sessions = createSessionRepository(db);
  const user = users.create('gera', 'хеш');
  const session = sessions.create(user.id, 30);
  db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', session.id);

  assert.equal(sessions.find(session.id), undefined);
  assert.equal(sessions.purgeExpired(), 1);
  cleanup();
});

test('выход уничтожает сессию', () => {
  const { db, cleanup } = createTestDatabase();
  const users = createUserRepository(db);
  const sessions = createSessionRepository(db);
  const user = users.create('gera', 'хеш');
  const session = sessions.create(user.id, 30);

  sessions.destroy(session.id);

  assert.equal(sessions.find(session.id), undefined);
  cleanup();
});

test('смена пароля может закрыть все сессии', () => {
  const { db, cleanup } = createTestDatabase();
  const users = createUserRepository(db);
  const sessions = createSessionRepository(db);
  const user = users.create('gera', 'хеш');
  sessions.create(user.id, 30);
  sessions.create(user.id, 30);

  assert.equal(sessions.destroyForUser(user.id), 2);
  cleanup();
});
