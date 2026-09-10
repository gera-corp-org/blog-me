import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/domain/markdown.js';

test('переводит Markdown в HTML', () => {
  const html = renderMarkdown('# Заголовок\n\nТекст со **сноской**.');
  assert.match(html, /<h1>Заголовок<\/h1>/);
  assert.match(html, /<strong>сноской<\/strong>/);
});

test('вырезает скрипт', () => {
  const html = renderMarkdown('Текст\n\n<script>alert(1)</script>');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('alert(1)'));
});

test('вырезает обработчики событий и javascript-ссылки', () => {
  const html = renderMarkdown('<a href="javascript:alert(1)" onclick="alert(2)">клик</a>');
  assert.ok(!html.includes('onclick'));
  assert.ok(!html.includes('javascript:'));
});

test('оставляет картинки и добавляет отложенную загрузку', () => {
  const html = renderMarkdown('![кот](/media/2026/09/abc.jpg)');
  assert.match(html, /<img[^>]+src="\/media\/2026\/09\/abc\.jpg"/);
  assert.match(html, /loading="lazy"/);
});

test('добавляет rel к ссылкам', () => {
  const html = renderMarkdown('[сайт](https://example.com)');
  assert.match(html, /rel="noopener noreferrer"/);
});

test('сохраняет блоки кода', () => {
  const html = renderMarkdown('```\nconst a = 1;\n```');
  assert.match(html, /<pre><code>/);
});

test('рендерит inline-сноску в sup со ссылкой', () => {
  const html = renderMarkdown('Утверждение.^[Сноска текст.]');
  assert.match(html, /<sup class="footnote-ref">/);
  assert.match(html, /<a href="#fn1"/);
  assert.match(html, /id="fnref1"/);
});

test('рендерит блок footnotes с обратной ссылкой', () => {
  const html = renderMarkdown('Текст.^[Сноска.]\n');
  assert.match(html, /<section class="footnotes">/);
  assert.match(html, /id="fn1"/);
  assert.match(html, /class="footnote-backref"/);
  assert.match(html, /#fnref1/);
});

test('рендерит именованную сноску с кликабельным URL', () => {
  const html = renderMarkdown('Факт[^src].\n\n[^src]: https://example.com — описание.\n');
  assert.match(html, /<a href="https:\/\/example.com"/);
  assert.match(html, /<section class="footnotes">/);
});

test('sanitize-html не вырезает id/class у footnote-элементов', () => {
  const html = renderMarkdown('А.^[Б.]\n');
  assert.match(html, /id="fn1"/);
  assert.match(html, /id="fnref1"/);
  assert.match(html, /class="footnote-ref"/);
  assert.match(html, /class="footnotes"/);
  assert.match(html, /class="footnote-backref"/);
});
