import Fastify from 'fastify';
import fastifyView from '@fastify/view';
import fastifyStatic from '@fastify/static';
import formbody from '@fastify/formbody';
import { Eta } from 'eta';
import { latestMigrationVersion } from './db/migrate.js';
import { createPostRepository } from './db/posts.js';
import { createTagRepository } from './db/tags.js';
import { formatDate } from './domain/format.js';
import { publicPostRoutes } from './routes/public/posts.js';
import { adminAuthRoutes } from './routes/admin/auth.js';
import securityPlugin from './plugins/security.js';
import authPlugin from './plugins/auth.js';

export function buildServer({ config, db, logger = false }) {
  const app = Fastify({ logger, trustProxy: config.trustProxy });

  app.decorate('config', config);
  app.decorate('db', db);
  app.decorate('posts', createPostRepository(db));
  app.decorate('tags', createTagRepository(db));

  app.register(formbody);
  app.register(securityPlugin);
  app.register(authPlugin);

  app.register(fastifyView, {
    engine: { eta: new Eta({ views: config.viewsDir, cache: config.isProduction }) },
    root: config.viewsDir,
    defaultContext: {
      site: {
        title: config.siteTitle,
        description: config.siteDescription,
        url: config.siteUrl,
        author: config.siteAuthor,
      },
      formatDate,
      q: '',
      user: null,
      csrf: '',
    },
  });

  app.register(fastifyStatic, {
    root: config.publicDir,
    prefix: '/static/',
    maxAge: config.isProduction ? '7d' : 0,
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).view('404.eta', { pageTitle: 'Не найдено' }));

  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/readyz', async (request, reply) => {
    try {
      const version = app.db.pragma('user_version', { simple: true });
      if (version < latestMigrationVersion(config.migrationsDir)) {
        return reply.code(503).send({ status: 'миграции не применены' });
      }
      app.db.prepare('SELECT 1').get();
      return { status: 'ok' };
    } catch (error) {
      request.log.error(error, 'проба готовности: база недоступна');
      return reply.code(503).send({ status: 'база недоступна' });
    }
  });

  app.register(publicPostRoutes);
  app.register(adminAuthRoutes);

  return app;
}
