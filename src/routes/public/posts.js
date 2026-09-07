export async function publicPostRoutes(app) {
  app.get('/', async (request, reply) => {
    const perPage = app.config.postsPerPage;
    const requested = Number.parseInt(request.query.page ?? '1', 10);
    const total = app.posts.countPublished();
    const pages = Math.max(1, Math.ceil(total / perPage));
    const page = Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), pages);

    const posts = app.posts.listPublished({ limit: perPage, offset: (page - 1) * perPage });
    const tagsByPost = app.tags.forPosts(posts.map((post) => post.id));

    return reply.view('index.eta', {
      pageTitle: app.config.siteTitle,
      posts: posts.map((post) => ({ ...post, tags: tagsByPost.get(post.id) })),
      page,
      pages,
    });
  });

  app.get('/p/:slug', async (request, reply) => {
    const post = app.posts.findBySlug(request.params.slug);
    if (!post || post.status !== 'published') {
      return reply.callNotFound();
    }

    return reply.view('post.eta', {
      pageTitle: `${post.title} — ${app.config.siteTitle}`,
      post,
      tags: app.tags.forPost(post.id),
    });
  });
}
