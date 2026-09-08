import { mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DAY_MS = 24 * 60 * 60 * 1000;
const NAME_PATTERN = /^blog-\d{4}-\d{2}-\d{2}\.db$/;
const TEMPORARY_PATTERN = /^blog-\d{4}-\d{2}-\d{2}\.db\.tmp$/;

export function makeBackup(db, backupsDir, keep, now = new Date()) {
  mkdirSync(backupsDir, { recursive: true });

  const target = join(backupsDir, `blog-${now.toISOString().slice(0, 10)}.db`);

  const temporary = `${target}.tmp`;

  // Любой .tmp, найденный здесь, — обрывок прошлого прерванного снимка:
  // снимок делается синхронно, двух одновременно быть не может. Обрывки за
  // прошлые числа под шаблон имени снимка не подходят и в ротацию не
  // попадают, поэтому иначе копились бы вечно, каждый размером с базу.
  for (const orphan of readdirSync(backupsDir).filter((name) => TEMPORARY_PATTERN.test(name))) {
    rmSync(join(backupsDir, orphan), { force: true });
  }

  db.prepare('VACUUM INTO ?').run(temporary);
  rmSync(target, { force: true });
  renameSync(temporary, target);

  // В очередь на удаление берём только обычные файлы. Каталог с похожим
  // именем иначе ломает ротацию навсегда: удалить его нечем, а стоит он
  // первым в очереди, и она не сдвинется ни в один из следующих дней.
  const existing = readdirSync(backupsDir)
    .filter((name) => NAME_PATTERN.test(name) && statSync(join(backupsDir, name)).isFile())
    .sort();
  for (const outdated of existing.slice(0, Math.max(0, existing.length - keep))) {
    rmSync(join(backupsDir, outdated), { force: true });
  }

  return target;
}

export function startBackupSchedule({ db, config, log }) {
  const run = () => {
    try {
      const file = makeBackup(db, config.backupsDir, config.backupKeep);
      log?.info(`снимок базы: ${file}`);
    } catch (error) {
      log?.error(error, 'снимок базы не удался');
    }
  };

  run();
  const timer = setInterval(run, DAY_MS);
  timer.unref();

  return () => clearInterval(timer);
}
