import Fastify from 'fastify';
import fastifyView from '@fastify/view';
import fastifyStatic from '@fastify/static';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import { mkdirSync } from 'node:fs';
import { Eta } from 'eta';
import { latestMigrationVersion } from './db/migrate.js';
import { createPostRepository } from './db/posts.js';
import { createTagRepository } from './db/tags.js';
import { formatDate } from './domain/format.js';
import { publicPostRoutes } from './routes/public/posts.js';
import { aboutRoutes } from './routes/public/about.js';
import { searchRoutes } from './routes/public/search.js';
import { feedRoutes } from './routes/public/feed.js';
import { adminAuthRoutes } from './routes/admin/auth.js';
import { adminPostRoutes } from './routes/admin/posts.js';
import { adminPasswordRoutes } from './routes/admin/password.js';
import { adminUploadRoutes } from './routes/admin/upload.js';
import securityPlugin from './plugins/security.js';
import authPlugin from './plugins/auth.js';

const ERROR_MESSAGES = {
  400: 'Некорректный запрос',
  403: 'Запрос отклонён',
  413: 'Файл слишком большой',
  415: 'Неподдерживаемый тип файла',
  429: 'Слишком много запросов',
  500: 'Внутренняя ошибка сервера',
};

export function buildServer({ config, db, logger = false }) {
  const app = Fastify({ logger, trustProxy: config.trustProxy });

  app.decorate('config', config);
  app.decorate('db', db);
  app.decorate('posts', createPostRepository(db));
  app.decorate('tags', createTagRepository(db));

  mkdirSync(config.uploadsDir, { recursive: true });

  app.register(formbody);
  app.register(multipart, {
    limits: { fileSize: config.uploadMaxBytes, files: 1 },
  });
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

  app.register(fastifyStatic, {
    root: config.uploadsDir,
    prefix: '/media/',
    decorateReply: false,
    index: false,
    maxAge: '365d',
    immutable: true,
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).view('404.eta', { pageTitle: 'Не найдено' }));

  // We write error bodies ourselves: library messages arrive in English and may
  // contain server paths. The code and a short Russian string go out; the details
  // go to the log. The browser is detected via the Accept header: a link
  // navigation gets a page, a request from the editor gets JSON.
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const status = error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500;
    const message = ERROR_MESSAGES[status] ?? 'Внутренняя ошибка сервера';

    if ((request.headers.accept ?? '').includes('text/html')) {
      return reply.code(status).view('500.eta', { pageTitle: 'Ошибка', message });
    }
    return reply.code(status).send({ error: message });
  });

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
  app.register(aboutRoutes);
  app.register(searchRoutes);
  app.register(feedRoutes);
  app.register(adminAuthRoutes);
  app.register(adminPostRoutes);
  app.register(adminPasswordRoutes);
  app.register(adminUploadRoutes);

  return app;
}
