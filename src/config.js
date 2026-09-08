import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const readInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Пустой список означает «не верить заголовку ни от кого»: Fastify ждёт
// здесь false, а не пустой массив.
const readList = (value, fallback) => {
  const entries = String(value ?? fallback).split(',').map((entry) => entry.trim()).filter(Boolean);
  return entries.length > 0 ? entries : false;
};

const readBool = (value, fallback) => {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
};

export function loadConfig(env = process.env) {
  // Путь приводится к абсолютному: библиотека отдачи файлов требует именно
  // такой и роняет приложение при старте, а значение по умолчанию —
  // относительное. resolve заодно убирает хвостовые слэши.
  const dataDir = resolve(env.DATA_DIR ?? './data');
  return {
    port: readInt(env.PORT, 3000),
    host: env.HOST ?? '0.0.0.0',
    // Кому верить, когда заголовок X-Forwarded-For называет адрес
    // посетителя. Заголовок принимается, только если сосед по соединению
    // сам входит в этот список, поэтому умолчание безопасно и за ingress
    // кластера (он в частной сети), и при прямом доступе из интернета
    // (там сосед — публичный адрес, и заголовку не верят). Число сюда
    // передавать бесполезно: Fastify намеренно не поддерживает доверие
    // «по числу узлов», потому что оно не проверяет самого соседа.
    trustProxy: readList(env.TRUST_PROXY, 'loopback,uniquelocal'),
    isProduction: env.NODE_ENV === 'production',

    dataDir,
    databasePath: env.DATABASE_PATH ?? `${dataDir}/blog.db`,
    uploadsDir: `${dataDir}/uploads`,
    backupsDir: `${dataDir}/backups`,
    migrationsDir: join(projectRoot, 'migrations'),
    viewsDir: join(projectRoot, 'views'),
    publicDir: join(projectRoot, 'public'),

    siteUrl: (env.SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
    siteTitle: env.SITE_TITLE ?? 'Блог',
    siteDescription: env.SITE_DESCRIPTION ?? '',
    siteAuthor: env.SITE_AUTHOR ?? '',

    postsPerPage: readInt(env.POSTS_PER_PAGE, 10),
    sessionTtlDays: readInt(env.SESSION_TTL_DAYS, 30),
    sessionSecret: env.SESSION_SECRET ?? 'небезопасный-ключ-для-разработки',
    cookieSecure: readBool(env.COOKIE_SECURE, true),
    uploadMaxBytes: readInt(env.UPLOAD_MAX_BYTES, 10 * 1024 * 1024),
    backupKeep: readInt(env.BACKUP_KEEP, 7),

    adminUsername: env.ADMIN_USERNAME,
    adminPassword: env.ADMIN_PASSWORD,
  };
}
