import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const readInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// An empty list means "trust the header from no one": Fastify expects false here,
// not an empty array.
const readList = (value, fallback) => {
  const entries = String(value ?? fallback).split(',').map((entry) => entry.trim()).filter(Boolean);
  return entries.length > 0 ? entries : false;
};

const readBool = (value, fallback) => {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
};

export function loadConfig(env = process.env) {
  // The path is made absolute: the static file library requires exactly that and
  // crashes the app at startup otherwise, and the default value is relative.
  // resolve also strips trailing slashes.
  const dataDir = resolve(env.DATA_DIR ?? './data');
  return {
    port: readInt(env.PORT, 3000),
    host: env.HOST ?? '0.0.0.0',
    // Who to trust when the X-Forwarded-For header names the visitor's address.
    // The header is accepted only if the connection peer is itself in this list,
    // so the default is safe both behind the cluster's ingress (it's on the
    // private network) and with direct internet access (there the peer is a
    // public address and the header is not trusted). Passing a number here is
    // pointless: Fastify deliberately does not support trust "by hop count",
    // because that does not verify the peer itself.
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
