import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { detectImageType } from '../../domain/imageType.js';

export async function adminUploadRoutes(app) {
  app.post('/admin/upload', { preHandler: [app.requireAuth, app.verifyCsrf] }, async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: 'Файл не передан' });

    let buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      return reply.code(413).send({ error: 'Файл слишком большой' });
    }
    if (file.file?.truncated) {
      return reply.code(413).send({ error: 'Файл слишком большой' });
    }

    const type = detectImageType(buffer);
    if (!type) {
      return reply.code(415).send({ error: 'Поддерживаются только jpeg, png, webp и gif' });
    }

    const now = new Date();
    const relative = [
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      `${createHash('sha256').update(buffer).digest('hex')}.${type.ext}`,
    ].join('/');

    const target = join(app.config.uploadsDir, relative);
    mkdirSync(dirname(target), { recursive: true });
    if (!existsSync(target)) writeFileSync(target, buffer);

    const url = `/media/${relative}`;
    return { url, markdown: `![](${url})` };
  });
}
