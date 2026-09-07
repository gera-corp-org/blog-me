import { loadConfig } from './config.js';
import { buildServer } from './server.js';
import { openDatabase } from './db/index.js';
import { applyMigrations } from './db/migrate.js';

const config = loadConfig();
const db = openDatabase(config.databasePath);
applyMigrations(db, config.migrationsDir);

const app = buildServer({ config, db, logger: true });

const shutdown = async () => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
