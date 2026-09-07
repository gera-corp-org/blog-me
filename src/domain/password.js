import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, {
    N: COST, r: BLOCK_SIZE, p: PARALLELIZATION,
  });
  return [
    'scrypt', COST, BLOCK_SIZE, PARALLELIZATION,
    salt.toString('base64'), key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, cost, blockSize, parallelization, salt, key] = parts;
  const expected = Buffer.from(key, 'base64');
  if (expected.length === 0) return false;

  try {
    const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, {
      N: Number(cost), r: Number(blockSize), p: Number(parallelization),
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
