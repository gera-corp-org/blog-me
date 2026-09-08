# Personal blog: design

Date: 2026-09-07

## 1. Goal

A blog site for personal notes. The owner writes posts through a web admin
panel in the browser; readers see the public part without registration. The
app is deployed in the owner's existing Kubernetes cluster.

The author and administrator are the same person. No multi-user work, roles
or moderation are planned.

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Publishing | Web admin with login, posts in the database | Write from the browser, including from a phone, without git or an editor |
| Stack | Node 22, Fastify, server-side templates | A light image, no frontend build, the whole app fits in one's head |
| Database | SQLite in a file on a PVC | A personal blog needs no network DBMS; backup is a file copy |
| Login | Username and password inside the app | No dependency on an external SSO provider |
| Markdown rendering | On the server, the result saved to the database | One parser for preview and publishing; a page is served in one request |
| Replicas | One, Recreate strategy | The SQLite file and RWO volume do not allow two writers |

## 3. Scope

In: a public feed with pagination, a post page, tags and filtering by them,
full-text search, an RSS/Atom feed, an admin panel with a Markdown editor
and server-side preview, drafts, image upload, password login, password
change, a container and Kubernetes manifests, a daily database backup.

Out: comments, analytics, email newsletters, multiple authors, scheduled
publishing, themes, imports from other blogs.

## 4. Architecture

### 4.1 Directory layout

```
src/
  db/          database open, migrations, repositories (posts, tags, users, sessions)
  domain/      pure functions: slug, Markdown render, sanitize, excerpt, validation
  routes/
    public/    feed, post, tag, search, RSS, media serving, probes
    admin/     login, list, editor, preview, upload, password change
  plugins/     sessions, template engine, static serving, rate limiting
  server.js    app assembly
  main.js      entry point: migrations, startup, backup scheduler
views/         page templates
migrations/    numbered SQL migration files
public/        styles and static files
test/          tests
deploy/helm/   Helm chart for Kubernetes
```

### 4.2 Layer boundaries

- `domain/` knows neither the database nor HTTP. Tested by calling functions.
- `db/` is the only place with SQL. Repositories return plain objects.
- `routes/` holds no logic: it parses the request, calls the domain and the
  repository, returns a template.

Boundary check: a route can be rewritten without touching the domain, and
vice versa.

## 5. Data

### 5.1 Schema

`posts`
- `id` INTEGER PRIMARY KEY
- `slug` TEXT NOT NULL UNIQUE
- `title` TEXT NOT NULL
- `body_md` TEXT NOT NULL — the source text, the single source of truth
- `body_html` TEXT NOT NULL — the render and sanitize result
- `excerpt` TEXT NOT NULL — the feed teaser
- `status` TEXT NOT NULL CHECK (status IN ('draft','published'))
- `created_at`, `updated_at` TEXT NOT NULL — ISO 8601, UTC
- `published_at` TEXT NULL — set on first publish

Index: `(status, published_at DESC)` — for the feed query.

`tags`: `id`, `name` TEXT NOT NULL, `slug` TEXT NOT NULL UNIQUE.

`post_tags`: `post_id`, `tag_id`, composite primary key, foreign keys with
cascading deletes.

`users`: `id`, `username` TEXT NOT NULL UNIQUE, `password_hash` TEXT NOT
NULL, `created_at`. One row expected.

`sessions`: `id` TEXT PRIMARY KEY (random token), `user_id`, `created_at`,
`expires_at`. Index on `expires_at` for cleanup.

`posts_fts`: a virtual FTS5 table over `title` and `body_md`, linked to
`posts` and synced by triggers on insert, update and delete. Search returns
only posts with status `published`.

### 5.2 Migrations

A `migrations/` directory with files like `001_init.sql`. The applied
version number is stored in the database itself (`PRAGMA user_version`). On
startup the missing ones are applied in ascending order, in a transaction.
Re-running is safe and does nothing.

Database mode: `journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout`.

### 5.3 Files

The volume is mounted at `/data`:

```
/data/blog.db          database
/data/uploads/2026/09/<sha256>.<ext>   images
/data/backups/         database snapshots
```

An image name is a content hash. Files are immutable, so they are served
with a long cache, and re-uploading the same image does not create a copy.

## 6. Routes

### 6.1 Public

| Method and path | Purpose |
|---|---|
| `GET /` | the feed of published posts, paginated |
| `GET /p/:slug` | post page |
| `GET /tag/:slug` | posts with a tag |
| `GET /search?q=` | full-text search |
| `GET /feed.xml` | subscription feed |
| `GET /media/*` | serving uploaded files |
| `GET /healthz` | process is alive |
| `GET /readyz` | migrations applied, database responds |

A draft at `/p/:slug` is served only with a valid session; to an anonymous
visitor it is a 404, not 403, so as not to reveal the existence of an
unpublished text.

### 6.2 Admin

All paths under `/admin` require a session, except the login page.

| Method and path | Purpose |
|---|---|
| `GET /admin/login`, `POST /admin/login` | login |
| `POST /admin/logout` | logout |
| `GET /admin` | post list with a status filter |
| `GET /admin/posts/new` | new post form |
| `GET /admin/posts/:id/edit` | edit form |
| `POST /admin/posts` | create |
| `POST /admin/posts/:id` | save |
| `POST /admin/posts/:id/delete` | delete |
| `POST /admin/preview` | preview HTML for the editor panel |
| `POST /admin/upload` | image upload, the response is a ready Markdown string |
| `GET /admin/password`, `POST /admin/password` | password change |

Post form: title, slug (auto-filled, editable by hand), comma-separated
tags, Markdown text. The "Save draft" and "Publish" buttons toggle `status`.

A published post's slug can be changed, but the old address stops working
after that: there are no redirects from old addresses, that is out of scope.

Preview renders on the server with the same code as publishing. There is no
second Markdown parser in the browser: otherwise preview and result would
one day diverge.

## 7. Authentication and security

The password is stored as a `scrypt` hash with a random salt, via Node's
built-in `crypto` module — no native dependencies. Hash comparison is
constant-time.

Session: 32 random bytes in an `httpOnly`, `sameSite=lax`, `secure` cookie
(`secure` is turned off by an env var for local http). A 30-day lifetime, a
row in `sessions`, expired ones removed at startup and once a day. Sessions
live in the database, not memory: a pod restart on deploy does not log you
out.

The first user is created at startup from `ADMIN_USERNAME` and
`ADMIN_PASSWORD`, only if the `users` table is empty. After that the
password is changed on the admin page; there is no need to touch the
database by hand.

Protections:

- A CSRF token in every form, checked on all POSTs.
- Login rate limiting: 10 attempts per 15 minutes per address. The counter
  lives in process memory — enough with one replica.
- HTML after Markdown rendering goes through a whitelist of tags and
  attributes. Your own text is not trusted either: a pasted piece of HTML
  with a script must not reach the page.
- File upload: type detected by content signature, not extension; a
  whitelist of jpeg, png, webp, gif; a size limit; served with a fixed
  `Content-Type` and headers that forbid interpreting the file as a page.
- Security headers on all responses, including the content policy.
- Secrets only from environment variables. There are no passwords in the
  repository.

## 8. Deployment

### 8.1 Image

A multi-stage `Dockerfile` on `node:22-bookworm-slim`. The glibc base,
rather than alpine, is chosen deliberately: the SQLite driver has ready
binary builds for glibc, so the image builds without a compiler. The build
stage installs dependencies; the final one copies only the production ones,
and the process runs as non-root.

### 8.2 Helm chart (`deploy/helm/blog/`)

Deployment is packaged as a Helm chart. Defaults are in `values.yaml`,
templates in `templates/` (Deployment, Service, Ingress,
PersistentVolumeClaim, ConfigMap, Secret, Namespace).

- `Deployment`: 1 replica, `strategy: Recreate`. Two replicas would corrupt
  the database, and the RWO volume could not be mounted twice anyway.
- `PersistentVolumeClaim`: RWO access, 10 Gi, storage class from
  `persistence.storageClassName`.
- `Service`: ClusterIP, port 80 → 3000.
- `Ingress`: blog domain (`ingress.host`), TLS (`ingress.tls`), nginx
  class. The cert-manager annotation is commented out.
- `ConfigMap`: site name, description, URL, page size and the rest of the
  8.3 variables, except secrets.
- `Secret`: `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`. There
  are no passwords in the repository: values are empty in `values.yaml` and
  passed at install (`--set secrets.sessionSecret=...`), or an existing
  Secret is referenced via `secrets.existingSecret`.
- Probes: `/healthz` — liveness, `/readyz` — readiness. Readiness answers
  "ready" only after migrations are applied, so traffic does not hit an
  un-migrated database.
- Resources: request 100m CPU and 256 Mi memory, limit 500m and 512 Mi.
- `securityContext`: non-root, read-only root filesystem, writes allowed to
  `/data` and `/tmp`, privileges dropped.

Install:

    helm install blog ./deploy/helm/blog -n blog --create-namespace \
      --set secrets.sessionSecret=... --set secrets.adminPassword=...

### 8.3 Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 3000 | port |
| `DATA_DIR` | `/data` | volume root |
| `SITE_URL` | required | absolute URL, needed for RSS |
| `SITE_TITLE`, `SITE_DESCRIPTION`, `SITE_AUTHOR` | required | header and feed |
| `POSTS_PER_PAGE` | 10 | feed page size |
| `SESSION_TTL_DAYS` | 30 | session lifetime |
| `COOKIE_SECURE` | `true` | turned off for local http |
| `UPLOAD_MAX_BYTES` | 10485760 | image size limit |
| `BACKUP_KEEP` | 7 | how many snapshots to keep |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | required | only for creating the first user |

### 8.4 Backups

Once a day the app takes a database snapshot via SQLite (`VACUUM INTO`)
into `/data/backups/blog-YYYY-MM-DD.db` and keeps the last `BACKUP_KEEP`
files.

A separate `CronJob` is deliberately not used: the RWO volume mounts on only
one node, and the backup pod risks being scheduled onto another node and
failing to start.

## 9. Testing

Development is TDD. Tests use Node's built-in runner (`node --test`), run
with `npm test`.

- Domain: calling pure functions — slugs, render, sanitize, excerpt.
- Repositories: a temporary file database, created per test.
- Routes: Fastify's internal request injection, without bringing up the
  network.

Required scenarios:

1. A draft is not visible to an anonymous visitor (404) and is visible to
   the owner with a session.
2. A login with a wrong password does not create a session.
3. `/admin` pages without a session lead to the login form.
4. A POST without a CSRF token is rejected.
5. Search finds a post by a word in the text and does not find a draft.
6. The `/feed.xml` feed is valid XML with absolute links.
7. A file outside the type whitelist is rejected on upload.
8. A script inside Markdown does not reach the served HTML.
9. A slug from a Russian title is transliterated: "Привет, мир" →
   `privet-mir`; on collision a numeric suffix is added.
10. Re-running migrations changes nothing.

## 10. Work order

Nine slices, each leaving the system in a working state.

1. **Scaffold.** Fastify, config from environment, database open,
   migrations, `/healthz` and `/readyz`, the first test, `npm test` green.
2. **Domain.** Slug with transliteration, Markdown render, sanitize,
   excerpt.
3. **Posts.** Repository and admin CRUD with drafts, no login yet. An
   editor with server-side preview.
4. **Login.** Users, sessions, CSRF, rate limiting, `/admin` protection,
   password change.
5. **Public part.** Feed with pagination, post page, tags.
6. **Images.** Upload, signature check, serving from `/media`.
7. **Search and RSS.** An FTS5 table with triggers, search page,
   `/feed.xml`.
8. **Styling.** Simple readable typography, responsive layout.
9. **Cluster.** Dockerfile, manifests, backups, deploy, check on the live
   domain.

## 11. Data needed before the ninth slice

The cluster owner must provide: the blog domain name, the storage class
name for the PVC, the ingress class and the certificate issuance method
(whether cert-manager exists and the issuer name). Until these are known,
the manifests are written with default parameters: the cluster's storage
class, the `nginx` ingress class, the cert-manager annotation commented out.
