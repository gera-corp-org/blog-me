import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ALLOWED = new Set(['\t', '\n', '\r']);

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.js') ? [path] : [];
  });
}

test('в исходниках нет невидимых управляющих символов', () => {
  for (const path of [...sourceFiles(join(ROOT, 'src')), ...sourceFiles(join(ROOT, 'test'))]) {
    const found = [...readFileSync(path, 'utf8')]
      .filter((character) => character.codePointAt(0) < 32 && !ALLOWED.has(character))
      .map((character) => `U+${character.codePointAt(0).toString(16).padStart(4, '0')}`);

    assert.deepEqual(found, [], `в ${path.slice(ROOT.length)} невидимые символы: ${found.join(', ')}`);
  }
});
