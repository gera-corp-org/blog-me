import { renderMarkdown } from '../../domain/markdown.js';
import { makeExcerpt } from '../../domain/excerpt.js';
import { slugify, uniqueSlug } from '../../domain/slug.js';
import { parseTagInput } from '../../db/tags.js';

function readForm(body) {
  return {
    title: String(body?.title ?? '').trim(),
    slugInput: String(body?.slug ?? '').trim(),
    tags: parseTagInput(body?.tags),
    bodyMd: String(body?.body ?? ''),
    status: body?.action === 'publish' ? 'published' : 'draft',
  };
}

export async function adminPostRoutes(app) {
  const read = { preHandler: app.requireAuth };
  const write = { preHandler: [app.requireAuth, app.verifyCsrf] };

  const editorPage = (request, reply, { post, tagsValue, error = null, code = 200 }) =>
    reply.code(code).view('admin/edit.eta', {
      pageTitle: post.id ? `Правка: ${post.title}` : 'Новая запись',
      csrf: request.csrfToken,
      user: request.user,
      post,
      tagsValue,
      error,
    });

  app.get('/admin', read, async (request, reply) => {
    const status = ['draft', 'published'].includes(request.query.status) ? request.query.status : null;
    const posts = app.posts.listAll(status);
    const tagsByPost = app.tags.forPosts(posts.map((post) => post.id));

    return reply.view('admin/list.eta', {
      pageTitle: 'Записи',
      csrf: request.csrfToken,
      user: request.user,
      status,
      posts: posts.map((post) => ({ ...post, tags: tagsByPost.get(post.id) })),
    });
  });

  app.get('/admin/posts/new', read, async (request, reply) =>
    editorPage(request, reply, {
      post: { id: null, title: '', slug: '', body_md: '', status: 'draft' },
      tagsValue: '',
    }));

  app.get('/admin/posts/:id/edit', read, async (request, reply) => {
    const post = app.posts.findById(Number(request.params.id));
    if (!post) return reply.callNotFound();

    return editorPage(request, reply, {
      post,
      tagsValue: app.tags.forPost(post.id).map((tag) => tag.name).join(', '),
    });
  });

  // Creation and editing differ only in whether there is an existing post.
  // We keep the shared code in one place: the diverged copies already produced
  // a discrepancy — with an empty title, editing lost the selected status while
  // creation did not.
  const saveForm = async (request, reply, existing) => {
    const form = readForm(request.body);

    if (!form.title) {
      return editorPage(request, reply, {
        code: 400,
        error: 'Заголовок обязателен.',
        post: {
          id: existing?.id ?? null,
          title: form.title,
          slug: form.slugInput,
          body_md: form.bodyMd,
          status: form.status,
        },
        tagsValue: form.tags.join(', '),
      });
    }

    const bodyHtml = renderMarkdown(form.bodyMd);
    const fields = {
      slug: uniqueSlug(
        slugify(form.slugInput || form.title),
        (candidate) => app.posts.slugExists(candidate, existing?.id ?? null),
      ),
      title: form.title,
      bodyMd: form.bodyMd,
      bodyHtml,
      excerpt: makeExcerpt(bodyHtml),
      status: form.status,
    };

    const post = existing ? app.posts.update(existing.id, fields) : app.posts.create(fields);
    app.tags.setForPost(post.id, form.tags);

    return reply.redirect(`/admin/posts/${post.id}/edit`, 303);
  };

  app.post('/admin/posts', write, async (request, reply) => saveForm(request, reply, null));

  app.post('/admin/posts/:id', write, async (request, reply) => {
    const existing = app.posts.findById(Number(request.params.id));
    if (!existing) return reply.callNotFound();

    return saveForm(request, reply, existing);
  });

  app.post('/admin/posts/:id/delete', write, async (request, reply) => {
    app.posts.remove(Number(request.params.id));
    return reply.redirect('/admin', 303);
  });

  app.post('/admin/preview', write, async (request) => ({
    html: renderMarkdown(request.body?.body ?? ''),
  }));
}
