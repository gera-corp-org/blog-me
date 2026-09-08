export async function aboutRoutes(app) {
  app.get('/about', async (request, reply) =>
    reply.view('about.eta', {
      pageTitle: `Обо мне — ${app.config.siteTitle}`,
      user: request.user,
      csrf: request.csrfToken,
    }));
}
