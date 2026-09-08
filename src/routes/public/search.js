import { toMatchQuery } from '../../domain/search.js';

const LIMIT = 50;

export async function searchRoutes(app) {
  app.get('/search', async (request, reply) => {
    const query = String(request.query.q ?? '').trim();
    const posts = app.posts.search(toMatchQuery(query), { limit: LIMIT });

    return reply.view('search.eta', {
      pageTitle: query ? `Поиск: ${query}` : 'Поиск',
      q: query,
      posts,
      user: request.user,
      csrf: request.csrfToken,
    });
  });
}
