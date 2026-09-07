import test from 'node:test';
import assert from 'node:assert/strict';
import { paginate } from '../src/domain/pagination.js';

test('первая страница при пустой ленте', () => {
  assert.deepEqual(paginate({ total: 0, perPage: 10, requested: undefined }),
    { page: 1, pages: 1, limit: 10, offset: 0 });
});

test('считает смещение по номеру страницы', () => {
  assert.deepEqual(paginate({ total: 25, perPage: 10, requested: '3' }),
    { page: 3, pages: 3, limit: 10, offset: 20 });
});

test('схлопывает номер за границами в допустимый', () => {
  assert.equal(paginate({ total: 5, perPage: 2, requested: '999' }).page, 3);
  assert.equal(paginate({ total: 5, perPage: 2, requested: '0' }).page, 1);
  assert.equal(paginate({ total: 5, perPage: 2, requested: '-5' }).page, 1);
});

test('нечисловой номер считается первой страницей', () => {
  assert.equal(paginate({ total: 5, perPage: 2, requested: 'абв' }).page, 1);
  assert.equal(paginate({ total: 5, perPage: 2, requested: '' }).page, 1);
});
