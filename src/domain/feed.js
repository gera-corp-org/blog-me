const REPLACEMENTS = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&'"]/g, (character) => REPLACEMENTS[character]);
}

export function buildAtomFeed({ site, posts, updatedAt = new Date().toISOString() }) {
  const entries = posts
    .map((post) => {
      const url = `${site.url}/p/${post.slug}`;
      return `  <entry>
    <title>${escapeXml(post.title)}</title>
    <link href="${escapeXml(url)}"/>
    <id>${escapeXml(url)}</id>
    <published>${escapeXml(post.published_at ?? post.created_at)}</published>
    <updated>${escapeXml(post.updated_at)}</updated>
    <summary>${escapeXml(post.excerpt)}</summary>
    <content type="html">${escapeXml(post.body_html)}</content>
  </entry>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(site.title)}</title>
  <subtitle>${escapeXml(site.description)}</subtitle>
  <link rel="self" href="${escapeXml(site.url)}/feed.xml"/>
  <link href="${escapeXml(site.url)}/"/>
  <id>${escapeXml(site.url)}/</id>
  <updated>${escapeXml(updatedAt)}</updated>
  <author><name>${escapeXml(site.author)}</name></author>
${entries}
</feed>
`;
}
