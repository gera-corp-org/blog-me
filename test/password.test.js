import test from 'node:test';
import assert from 'node:assert/strict';
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

test('не падает на испорченном хеше', async () => {
  assert.equal(await verifyPassword('пароль', 'мусор'), false);
  assert.equal(await verifyPassword('пароль', ''), false);
});
