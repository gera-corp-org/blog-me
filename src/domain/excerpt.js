const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

// A block end or line break becomes a space, otherwise neighbouring paragraphs
// would merge into "First paragraph.Second paragraph.". Other tags are stripped
// entirely, otherwise a space would appear before a period.
const BLOCK_BOUNDARY =
  /<\/(p|div|h[1-6]|li|ul|ol|blockquote|pre|figure|figcaption|table|tr|td|th)>|<br\s*\/?>/gi;

export function makeExcerpt(html, limit = 200) {
  const text = String(html ?? '')
    .replace(BLOCK_BOUNDARY, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g, (entity) => ENTITIES[entity])
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= limit) return text;

  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.trimEnd()}…`;
}
