import fp from 'fastify-plugin';
import { createPageViewRepository } from '../db/pageViews.js';

// Page-view counter: one row per path, incremented after a successful HTML
// page is served. Only the public pages are counted; assets, media, the feed,
// admin, probes and error responses are skipped.
async function pageViewsPlugin(app) {
  app.decorate('pageViews', createPageViewRepository(app.db));

  app.addHook('onResponse', async (request, reply) => {
    if (request.method !== 'GET') return;
    if (reply.statusCode !== 200) return;
    if (!String(reply.getHeader('content-type') ?? '').includes('text/html')) return;

    const url = request.routeOptions?.url;
    let key = null;
    if (url === '/') key = '/';
    else if (url === '/p/:slug') key = `/p/${request.params.slug}`;
    else if (url === '/tag/:slug') key = `/tag/${request.params.slug}`;
    else if (url === '/about') key = '/about';
    else if (url === '/search') key = '/search';

    if (key) app.pageViews.increment(key);
  });
}

export default fp(pageViewsPlugin, { name: 'pageViews' });
