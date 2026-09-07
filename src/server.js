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
import { adminAuthRoutes } from './routes/admin/auth.js';
import { adminPostRoutes } from './routes/admin/posts.js';
import { adminPasswordRoutes } from './routes/admin/password.js';
import { adminUploadRoutes } from './routes/admin/upload.js';
import securityPlugin from './plugins/security.js';
import authPlugin from './plugins/auth.js';

// Библиотеки говорят по-английски и норовят упомянуть путь на диске
// (например, отказ fastify-static показать содержимое каталога, или
// EACCES/ENOTDIR при работе с файлами). Наружу уходит только код и
// короткая строка из этой таблицы, подробности — в лог.
const ERROR_MESSAGES = {
  400: 'Некорректный запрос',
  403: 'Доступ запрещён',
  413: 'Файл слишком большой',
  415: 'Недопустимый тип содержимого',
};
const DEFAULT_ERROR_MESSAGE = 'Внутренняя ошибка сервера';

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

  // Общий обработчик: наружу — только код и короткая русская строка,
  // подробности (включая пути на сервере) остаются в логе. Переход по
  // ссылке получает страницу, запрос из скрипта редактора — JSON: браузер
  // отличается по заголовку Accept, который для перехода по ссылке
  // включает text/html, а для fetch() по умолчанию — нет.
  app.setErrorHandler((error, request, reply) => {
    const statusCode = Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500;
    if (statusCode >= 500) {
      request.log.error(error, 'необработанная ошибка');
    }
    const message = ERROR_MESSAGES[statusCode] ?? DEFAULT_ERROR_MESSAGE;

    if (request.headers.accept?.includes('text/html')) {
      return reply.code(statusCode).view('500.eta', { pageTitle: 'Ошибка', user: request.user });
    }
    return reply.code(statusCode).send({ error: message });
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
  app.register(adminAuthRoutes);
  app.register(adminPostRoutes);
  app.register(adminPasswordRoutes);
  app.register(adminUploadRoutes);

  return app;
}
