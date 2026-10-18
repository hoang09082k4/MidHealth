// Per-process abuse protection. OTP attempt limits are also enforced in PostgreSQL.
export function createRateLimiter({ limit, windowMs, maxKeys = 10000, now = Date.now }) {
  const entries = new Map();
  let nextCleanup = 0;
  return (key) => {
    const time = now();
    if (time >= nextCleanup) {
      for (const [storedKey, value] of entries) if (value.resetAt <= time) entries.delete(storedKey);
      nextCleanup = time + Math.min(windowMs, 60000);
    }
    let entry = entries.get(key);
    if (!entry || entry.resetAt <= time) {
      if (!entry && entries.size >= maxKeys) return true;
      entry = { count: 0, resetAt: time + windowMs };
      entries.set(key, entry);
    }
    entry.count += 1;
    return entry.count > limit;
  };
}
