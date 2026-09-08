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
    } catch (error) {
      // We specifically handle the size limit: a blanket catch would also report
      // "file too large" on unrelated failures, which is misleading.
      if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.code(413).send({ error: 'Файл слишком большой' });
      }
      throw error;
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
    try {
      mkdirSync(dirname(target), { recursive: true });
      if (!existsSync(target)) writeFileSync(target, buffer);
    } catch (error) {
      // Outward goes a short Russian string; the details with server paths stay
      // in the log: they reveal more about the machine's layout than necessary.
      request.log.error(error, 'не удалось сохранить картинку');
      return reply.code(500).send({ error: 'Не удалось сохранить картинку' });
    }

    const url = `/media/${relative}`;
    return { url, markdown: `![](${url})` };
  });
}
