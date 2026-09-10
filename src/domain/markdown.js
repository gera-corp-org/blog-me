import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import hljs from 'highlight.js';
import sanitizeHtml from 'sanitize-html';

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try { return hljs.highlight(str, { language: lang }).value; }
      catch { /* fall through */ }
    }
    return ''; // use external default escaping
  },
}).use(footnote);

const OPTIONS = {
  allowedTags: [
    'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'span',
    'em', 'strong', 'del', 's', 'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'figure', 'figcaption',
    'sup', 'section',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'rel', 'id', 'class'],
    img: ['src', 'alt', 'title', 'loading'],
    code: ['class'],
    span: ['class'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    sup: ['class'],
    section: ['class'],
    li: ['id', 'class'],
    hr: ['class'],
    ol: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }),
  },
};

export function renderMarkdown(source) {
  return sanitizeHtml(markdown.render(String(source ?? '')), OPTIONS);
}
