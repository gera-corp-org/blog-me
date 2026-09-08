import { buildAtomFeed } from '../../domain/feed.js';

const LIMIT = 20;

export async function feedRoutes(app) {
  app.get('/feed.xml', async (request, reply) => {
    const posts = app.posts.listPublished({ limit: LIMIT, offset: 0 });
    const xml = buildAtomFeed({
      site: {
        title: app.config.siteTitle,
        description: app.config.siteDescription,
        url: app.config.siteUrl,
        author: app.config.siteAuthor,
      },
      posts,
      updatedAt: posts[0]?.updated_at ?? new Date().toISOString(),
    });

    return reply.type('application/atom+xml; charset=utf-8').send(xml);
  });
}
