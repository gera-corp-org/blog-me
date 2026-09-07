import { hashPassword, verifyPassword } from '../../domain/password.js';

const MIN_LENGTH = 10;

export async function adminPasswordRoutes(app) {
  const page = (request, reply, { error = null, notice = null, code = 200 }) =>
    reply.code(code).view('admin/password.eta', {
      pageTitle: 'Смена пароля',
      csrf: request.csrfToken,
      user: request.user,
      error,
      notice,
    });

  app.get('/admin/password', { preHandler: app.requireAuth }, async (request, reply) =>
    page(request, reply, {}));

  app.post('/admin/password', { preHandler: [app.requireAuth, app.verifyCsrf] }, async (request, reply) => {
    const current = String(request.body?.current ?? '');
    const next = String(request.body?.next ?? '');
    const repeat = String(request.body?.repeat ?? '');
    const user = app.users.findById(request.user.id);

    if (!(await verifyPassword(current, user.password_hash))) {
      return page(request, reply, { code: 400, error: 'Текущий пароль неверен.' });
    }
    if (next.length < MIN_LENGTH) {
      return page(request, reply, { code: 400, error: `Новый пароль короче ${MIN_LENGTH} знаков.` });
    }
    if (next !== repeat) {
      return page(request, reply, { code: 400, error: 'Новый пароль и повтор не совпали.' });
    }

    app.users.updatePassword(user.id, await hashPassword(next));
    app.sessions.destroyForUser(user.id);
    app.startSession(reply, user.id);

    return page(request, reply, { notice: 'Пароль изменён, остальные сессии закрыты.' });
  });
}
