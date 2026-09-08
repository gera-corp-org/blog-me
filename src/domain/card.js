const IMAGE_SOURCE = /<img[^>]+src="([^"]+)"/i;
const TONES = 8;

// The cover is taken from the post itself: the first image in the text is its face.
// There is deliberately no separate cover field — otherwise it would have to be
// filled in by hand for every post.
export function coverImage(html) {
  const found = IMAGE_SOURCE.exec(String(html ?? ''));
  return found ? found[1] : null;
}

// The placeholder color is derived from the post's address rather than chosen at
// random: a given post always gets the same tile color, otherwise the feed would
// flicker on every reload. We return an index, not a color: the security policy
// forbids inline styles, so the colors live in the stylesheet.
export function placeholderTone(slug) {
  let hash = 0;
  for (const character of String(slug ?? '')) {
    hash = (hash * 31 + character.codePointAt(0)) % 1000003;
  }
  return hash % TONES;
}

export function toCard(post, tags = []) {
  return {
    ...post,
    tags,
    cover: coverImage(post.body_html),
    tone: placeholderTone(post.slug),
    letter: String(post.title ?? '').trim().charAt(0).toUpperCase(),
  };
}
