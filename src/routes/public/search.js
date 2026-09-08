import { toMatchQuery } from '../../domain/search.js';

const LIMIT = 50;

export async function searchRoutes(app) {
  app.get('/search', async (request, reply) => {
    const query = String(request.query.q ?? '').trim();
    const posts = app.posts.search(toMatchQuery(query), { limit: LIMIT });
    const tagsByPost = app.tags.forPosts(posts.map((post) => post.id));

    return reply.view('search.eta', {
      pageTitle: query ? `Поиск: ${query}` : 'Поиск',
      q: query,
      posts: posts.map((post) => ({ ...post, tags: tagsByPost.get(post.id) })),
      user: request.user,
      csrf: request.csrfToken,
    });
  });
}
