# Блог

Личный блог: публичная часть и админка с редактором Markdown.
Одно приложение на Node, база SQLite на диске.

## Разработка

    npm install
    npm test
    DATA_DIR=./data COOKIE_SECURE=false \
      ADMIN_USERNAME=gera ADMIN_PASSWORD=пароль12345 npm run dev

Открыть http://localhost:3000, войти на /admin/login.

## Переменные окружения

| Переменная | По умолчанию | Смысл |
|---|---|---|
| `PORT` | 3000 | порт |
| `TRUST_PROXY` | `loopback,uniquelocal` | чьему заголовку с адресом посетителя верить; пустое значение — не верить никому |
| `DATA_DIR` | `./data` | корень для базы, картинок и снимков |
| `SITE_URL` | `http://localhost:3000` | абсолютный адрес, нужен для ленты подписки |
| `SITE_TITLE` | `Блог` | название в шапке |
| `SITE_DESCRIPTION` | пусто | подпись в подвале и ленте |
| `SITE_AUTHOR` | пусто | автор в ленте |
| `POSTS_PER_PAGE` | 10 | размер страницы ленты |
| `SESSION_TTL_DAYS` | 30 | срок сессии |
| `SESSION_SECRET` | ключ для разработки | подпись cookie, в бою обязателен |
| `COOKIE_SECURE` | `true` | ставить `false` только для локального http |
| `UPLOAD_MAX_BYTES` | 10485760 | предел размера картинки |
| `BACKUP_KEEP` | 7 | сколько снимков базы хранить |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | нет | создают первого пользователя при пустой базе |

## Про доверие к прокси

Ограничение попыток входа считает попытки по адресу посетителя, а за
ingress этот адрес приходит в заголовке. Заголовку верят только от
соседа по соединению из списка `TRUST_PROXY`.

Умолчание `loopback,uniquelocal` рассчитано на обычный кластер: ingress
стоит в частной сети, значит его заголовку можно верить. Обратная
сторона — верить будут любому поду из частной сети, а не только ingress.
Если рядом есть недоверенные поды, сузьте список до адреса или подсети
самого ingress-контроллера. Пустое значение (`TRUST_PROXY=`) отключает
доверие заголовку совсем: тогда адресом каждого посетителя станет адрес
ingress, и ограничение попыток превратится в общий счётчик на всех.

## Развёртывание

    docker build -t gera-blog:1.0.0 .
    kubectl -n blog create secret generic blog-secrets \
      --from-literal=SESSION_SECRET="$(openssl rand -hex 32)" \
      --from-literal=ADMIN_USERNAME=gera \
      --from-literal=ADMIN_PASSWORD='пароль'
    kubectl apply -k deploy/k8s

Реплика всегда одна: SQLite и том RWO не допускают двух писателей.

## Бэкапы

Приложение раз в сутки кладёт снимок базы в `$DATA_DIR/backups` и хранит
последние `BACKUP_KEEP` файлов. Забрать снимок из кластера:

    kubectl -n blog cp blog-<под>:/data/backups/blog-2026-09-07.db ./blog.db

## Документы

- Дизайн: `docs/superpowers/specs/2026-09-07-blog-design.md`
- План работ: `docs/superpowers/plans/2026-09-07-blog.md`
