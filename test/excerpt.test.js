import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExcerpt } from '../src/domain/excerpt.js';

test('убирает разметку', () => {
  assert.equal(makeExcerpt('<p>Просто <strong>текст</strong>.</p>'), 'Просто текст.');
});

test('раскрывает html-сущности', () => {
  assert.equal(makeExcerpt('<p>Кот &amp; пёс</p>'), 'Кот & пёс');
});

test('обрезает по границе слова и ставит многоточие', () => {
  const excerpt = makeExcerpt(`<p>${'слово '.repeat(60)}</p>`, 50);
  assert.ok(excerpt.length <= 51, `слишком длинно: ${excerpt.length}`);
  assert.ok(excerpt.endsWith('…'));
  assert.ok(!excerpt.includes('  '));
});

test('короткий текст остаётся без многоточия', () => {
  assert.equal(makeExcerpt('<p>Коротко</p>', 50), 'Коротко');
});

test('разделяет соседние блоки пробелом', () => {
  assert.equal(makeExcerpt('<p>Первый.</p><p>Второй.</p>'), 'Первый. Второй.');
  assert.equal(makeExcerpt('<ul><li>раз</li><li>два</li></ul>'), 'раз два');
  assert.equal(makeExcerpt('<p>Строка<br>вторая</p>'), 'Строка вторая');
});
