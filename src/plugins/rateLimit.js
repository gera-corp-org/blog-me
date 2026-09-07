export function createRateLimiter({ limit, windowMs, now = () => Date.now() }) {
  const hits = new Map();

  return {
    check(key) {
      const current = now();
      const entry = hits.get(key);

      if (!entry || entry.resetAt <= current) {
        hits.set(key, { count: 1, resetAt: current + windowMs });
        return true;
      }

      entry.count += 1;
      return entry.count <= limit;
    },

    reset(key) {
      hits.delete(key);
    },
  };
}
