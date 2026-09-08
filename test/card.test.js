import test from 'node:test';
import assert from 'node:assert/strict';
import { coverImage, placeholderTone, toCard } from '../src/domain/card.js';

test('берёт первую картинку из текста записи', () => {
  const html = '<p>Вступление</p><img src="/media/2026/09/a.jpg" alt="кот"><img src="/media/b.png">';

  assert.equal(coverImage(html), '/media/2026/09/a.jpg');
});

test('без картинок обложки нет', () => {
  assert.equal(coverImage('<p>Только текст</p>'), null);
  assert.equal(coverImage(''), null);
  assert.equal(coverImage(undefined), null);
});

test('цвет заглушки постоянен для записи и различается между записями', () => {
  // The color is derived from the address, so a given post always gets one and
  // the same badge — otherwise the feed would flicker with different colors on each reload.
  assert.equal(placeholderTone('privet-mir'), placeholderTone('privet-mir'));

  const tones = new Set(['a', 'b', 'c', 'privet-mir', 'kot', 'o-dline-stroki'].map(placeholderTone));
  assert.ok(tones.size > 1, 'все адреса дали один и тот же цвет');
  for (const tone of tones) {
    assert.ok(Number.isInteger(tone) && tone >= 0 && tone < 8, `цвет вне диапазона: ${tone}`);
  }
});

test('карточка собирает обложку, букву и цвет', () => {
  const withImage = toCard(
    { slug: 'kot', title: 'Про котов', body_html: '<p>т</p><img src="/media/k.jpg">' },
    [{ name: 'Живность', slug: 'zhivnost' }],
  );

  assert.equal(withImage.cover, '/media/k.jpg');
  assert.equal(withImage.letter, 'П');
  assert.deepEqual(withImage.tags.map((tag) => tag.name), ['Живность']);

  const withoutImage = toCard({ slug: 'kot', title: 'Про котов', body_html: '<p>т</p>' });

  assert.equal(withoutImage.cover, null);
  assert.equal(withoutImage.tone, placeholderTone('kot'));
  assert.deepEqual(withoutImage.tags, []);
});
