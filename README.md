# Blog

A personal blog: a public site plus an admin panel with a Markdown editor.
One Node application, a SQLite database on disk.

## Development

    npm install
    npm test
    DATA_DIR=./data COOKIE_SECURE=false \
      ADMIN_USERNAME=gera ADMIN_PASSWORD='pick-a-password' npm run dev

The password from this command creates the user in the local database on
first run, so substitute your own instead of leaving the example: otherwise
your blog's login and password would be written into an open repository file.

Open http://localhost:3000 and log in at /admin/login.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 3000 | port |
| `TRUST_PROXY` | `loopback,uniquelocal` | whose visitor-address header to trust; an empty value trusts nobody |
| `DATA_DIR` | `./data` | root for the database, images and snapshots |
| `SITE_URL` | `http://localhost:3000` | absolute URL, needed for the subscription feed |
| `SITE_TITLE` | `Blog` | title in the header |
| `SITE_DESCRIPTION` | empty | tagline in the footer and feed |
| `SITE_AUTHOR` | empty | author in the feed |
| `POSTS_PER_PAGE` | 10 | feed page size |
| `SESSION_TTL_DAYS` | 30 | session lifetime |
| `SESSION_SECRET` | a dev key | cookie signature; required in production |
| `COOKIE_SECURE` | `true` | set `false` only for local http |
| `UPLOAD_MAX_BYTES` | 10485760 | image size limit |
| `BACKUP_KEEP` | 7 | how many database snapshots to keep |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | none | create the first user when the database is empty |

## About proxy trust

The login rate limit counts attempts by the visitor's address, and behind
ingress that address arrives in a header. The header is trusted only from the
connection peer listed in `TRUST_PROXY`.

The default `loopback,uniquelocal` is meant for an ordinary cluster: ingress
sits on the private network, so its header can be trusted. The flip side is
that any pod in the private network is trusted, not just ingress. If there
are untrusted pods nearby, narrow the list to the ingress controller's
address or subnet. An empty value (`TRUST_PROXY=`) disables header trust
entirely: every visitor's address becomes the ingress address, and the rate
limit turns into a shared counter for everyone.

## Deployment

The app ships as a Helm chart (`deploy/helm/blog`) and a container image
published to GHCR.

    helm install blog ./deploy/helm/blog \
      --set secrets.sessionSecret="$(openssl rand -hex 32)" \
      --set secrets.adminPassword='...' \
      --set config.SITE_URL="https://blog.example.com" \
      --set ingress.host="blog.example.com"

The chart creates the `blog` namespace itself (`namespace.create`). Secrets
are empty in `values.yaml` and are passed at install time, so no credentials
ever land in the repository.

CI builds and pushes the image to `ghcr.io/gera-corp-org/blog-me` on every
push to `master` (tag `latest`) and on release tags `vX.Y.Z` (tags `X.Y.Z`
and `X.Y`). The chart resolves the image version from `appVersion` in
`Chart.yaml`.

There is always a single replica: SQLite and the RWO volume do not allow two
writers.

## Backups

The app writes a database snapshot to `$DATA_DIR/backups` once a day and
keeps the last `BACKUP_KEEP` files. To pull a snapshot out of the cluster:

    kubectl -n blog cp blog-<pod>:/data/backups/blog-2026-09-07.db ./blog.db

## Documents

- Design: `docs/superpowers/specs/2026-09-07-blog-design.md`
