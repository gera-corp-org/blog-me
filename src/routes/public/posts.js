import { toCard } from '../../domain/card.js';
import { paginate } from '../../domain/pagination.js';

export async function publicPostRoutes(app) {
  app.get('/', async (request, reply) => {
    const { page, pages, limit, offset } = paginate({
      total: app.posts.countPublished(),
      perPage: app.config.postsPerPage,
      requested: request.query.page,
    });

    const posts = app.posts.listPublished({ limit, offset });
    const tagsByPost = app.tags.forPosts(posts.map((post) => post.id));

    return reply.view('index.eta', {
      pageTitle: app.config.siteTitle,
      posts: posts.map((post) => toCard(post, tagsByPost.get(post.id))),
      page,
      pages,
      user: request.user,
      csrf: request.csrfToken,
    });
  });

  app.get('/p/:slug', async (request, reply) => {
    const post = app.posts.findBySlug(request.params.slug);
    if (!post || (post.status !== 'published' && !request.user)) {
      return reply.callNotFound();
    }

    return reply.view('post.eta', {
      pageTitle: `${post.title} — ${app.config.siteTitle}`,
      post,
      tags: app.tags.forPost(post.id),
      user: request.user,
      csrf: request.csrfToken,
    });
  });

  app.get('/tag/:slug', async (request, reply) => {
    const tag = app.tags.findBySlug(request.params.slug);
    if (!tag) return reply.callNotFound();

    const { page, pages, limit, offset } = paginate({
      total: app.posts.countByTag(tag.slug),
      perPage: app.config.postsPerPage,
      requested: request.query.page,
    });

    return reply.view('tag.eta', {
      pageTitle: `Тег «${tag.name}» — ${app.config.siteTitle}`,
      tag,
      posts: app.posts.listByTag(tag.slug, { limit, offset }).map((post) => toCard(post)),
      page,
      pages,
      user: request.user,
      csrf: request.csrfToken,
    });
  });
}
