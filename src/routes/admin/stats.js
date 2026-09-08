export async function adminStatsRoutes(app) {
  const read = { preHandler: app.requireAuth };

  app.get('/admin/stats', read, async (request, reply) => {
    const stats = app.pageViews.list().map((row) => {
      let label = row.path;
      if (row.path === '/') label = 'Главная';
      else if (row.path.startsWith('/p/')) {
        const post = app.posts.findBySlug(row.path.slice(3));
        label = post ? post.title : row.path;
      }
      return { path: row.path, views: row.views, label };
    });

    return reply.view('admin/stats.eta', {
      pageTitle: 'Статистика',
      csrf: request.csrfToken,
      user: request.user,
      total: app.pageViews.total(),
      stats,
    });
  });
}
