import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/plugins/rateLimit.js';

test('пропускает до предела и отсекает дальше', () => {
  const limiter = createRateLimiter({ limit: 3, windowMs: 1000, now: () => 0 });

  assert.equal(limiter.check('ip'), true);
  assert.equal(limiter.check('ip'), true);
  assert.equal(limiter.check('ip'), true);
  assert.equal(limiter.check('ip'), false);
});

test('окно истекает и счётчик обнуляется', () => {
  let clock = 0;
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => clock });

  assert.equal(limiter.check('ip'), true);
  assert.equal(limiter.check('ip'), false);
  clock = 1001;
  assert.equal(limiter.check('ip'), true);
});

test('считает адреса раздельно и умеет сбрасывать', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });

  assert.equal(limiter.check('первый'), true);
  assert.equal(limiter.check('второй'), true);
  assert.equal(limiter.check('первый'), false);
  limiter.reset('первый');
  assert.equal(limiter.check('первый'), true);
});
