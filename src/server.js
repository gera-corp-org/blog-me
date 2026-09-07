import Fastify from 'fastify';
import { latestMigrationVersion } from './db/migrate.js';

export function buildServer({ config, db, logger = false }) {
  const app = Fastify({ logger, trustProxy: true });

  app.decorate('config', config);
  app.decorate('db', db);

  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/readyz', async (request, reply) => {
    try {
      const version = app.db.pragma('user_version', { simple: true });
      if (version < latestMigrationVersion(config.migrationsDir)) {
        return reply.code(503).send({ status: 'миграции не применены' });
      }
      app.db.prepare('SELECT 1').get();
      return { status: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'база недоступна' });
    }
  });

  return app;
}
