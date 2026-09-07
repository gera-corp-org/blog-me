import Fastify from 'fastify';

export function buildServer({ config, db, logger = false }) {
  const app = Fastify({ logger, trustProxy: true });

  app.decorate('config', config);
  app.decorate('db', db);

  app.get('/healthz', async () => ({ status: 'ok' }));

  return app;
}
