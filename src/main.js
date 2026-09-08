import { loadConfig } from './config.js';
import { buildServer } from './server.js';
import { openDatabase } from './db/index.js';
import { applyMigrations } from './db/migrate.js';
import { ensureAdminUser } from './bootstrap.js';
import { startBackupSchedule } from './backup.js';

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

if (config.isProduction && config.sessionSecret === 'небезопасный-ключ-для-разработки') {
  throw new Error('в бою обязателен SESSION_SECRET');
}

await app.ready();
await ensureAdminUser({ users: app.users, config, log: app.log });
startBackupSchedule({ db, config, log: app.log });
app.sessions.purgeExpired();

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
