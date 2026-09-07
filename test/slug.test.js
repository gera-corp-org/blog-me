import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify, uniqueSlug } from '../src/domain/slug.js';

test('транслитерирует кириллицу', () => {
  assert.equal(slugify('Привет, мир'), 'privet-mir');
  assert.equal(slugify('Щука и ёж'), 'schuka-i-ezh');
  assert.equal(slugify('Объявление'), 'obyavlenie');
});

test('приводит латиницу к нижнему регистру и убирает лишнее', () => {
  assert.equal(slugify('  Hello, World!  '), 'hello-world');
  assert.equal(slugify('Node.js 22 — это хорошо'), 'node-js-22-eto-horosho');
});

test('подставляет запасное значение для пустого результата', () => {
  assert.equal(slugify(''), 'zapis');
  assert.equal(slugify('!!!'), 'zapis');
});

test('обрезает слишком длинный слаг', () => {
  assert.equal(slugify('а'.repeat(200)).length, 80);
});

test('после обрезки не остаётся хвостового дефиса', () => {
  // Пробел поставлен так, что дефис попадает ровно на границу среза:
  // 79 букв + дефис = 80-й символ. Без среза хвоста слаг кончался бы дефисом.
  const slug = slugify(`${'a'.repeat(79)} ${'b'.repeat(20)}`);
  assert.equal(slug, 'a'.repeat(79));
});

test('uniqueSlug добавляет номер при столкновении', () => {
  const taken = new Set(['privet-mir', 'privet-mir-2']);
  assert.equal(uniqueSlug('privet-mir', (slug) => taken.has(slug)), 'privet-mir-3');
  assert.equal(uniqueSlug('svobodno', (slug) => taken.has(slug)), 'svobodno');
});
