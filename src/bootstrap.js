import { hashPassword } from './domain/password.js';

export async function ensureAdminUser({ users, config, log }) {
  if (users.count() > 0) return false;

  if (!config.adminUsername || !config.adminPassword) {
    log?.warn('ADMIN_USERNAME и ADMIN_PASSWORD не заданы — пользователь не создан');
    return false;
  }

  users.create(config.adminUsername, await hashPassword(config.adminPassword));
  log?.info(`создан пользователь ${config.adminUsername}`);
  return true;
}
