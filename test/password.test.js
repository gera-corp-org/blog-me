import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { hashPassword, verifyPassword } from '../src/domain/password.js';

test('подтверждает верный пароль', async () => {
  const stored = await hashPassword('очень секретно');
  assert.equal(await verifyPassword('очень секретно', stored), true);
});

test('отвергает неверный пароль', async () => {
  const stored = await hashPassword('очень секретно');
  assert.equal(await verifyPassword('не то', stored), false);
});

test('каждый хеш имеет свою соль', async () => {
  const first = await hashPassword('одинаковый');
  const second = await hashPassword('одинаковый');
  assert.notEqual(first, second);
});

test('подтверждает пароль, захешированный со старыми параметрами', async () => {
  // The hash uses N=1024 instead of the current 16384. The check must read
  // the parameters from the string itself, otherwise changing them would invalidate all
  // stored passwords.
  const salt = randomBytes(16);
  const key = await promisify(scryptCallback)('пароль', salt, 64, { N: 1024, r: 8, p: 1 });
  const stored = ['scrypt', 1024, 8, 1, salt.toString('base64'), key.toString('base64')].join('$');

  assert.equal(await verifyPassword('пароль', stored), true);
  assert.equal(await verifyPassword('не тот', stored), false);
});

test('не падает на испорченном хеше', async () => {
  assert.equal(await verifyPassword('пароль', 'мусор'), false);
  assert.equal(await verifyPassword('пароль', ''), false);
});
