export class MemoryRateLimiter {
  constructor(options = {}) {
    const { limit = 20, windowMs = 300_000, now = () => Date.now(), maxKeys = 10_000 } = options;
    if (!Number.isInteger(limit) || limit < 1) throw new TypeError('limit must be a positive integer');
    if (!Number.isInteger(windowMs) || windowMs < 1_000) throw new TypeError('windowMs must be at least one second');
    if (!Number.isInteger(maxKeys) || maxKeys < 1) throw new TypeError('maxKeys must be a positive integer');
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.maxKeys = maxKeys;
    this.buckets = new Map();
  }

  cleanup(now) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
    while (this.buckets.size >= this.maxKeys) {
      this.buckets.delete(this.buckets.keys().next().value);
    }
  }

  async consume(key) {
    if (typeof key !== 'string' || !key || key.length > 1024) throw new TypeError('rate-limit key is invalid');
    const now = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.cleanup(now);
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    const allowed = bucket.count <= this.limit;
    return {
      allowed,
      limit: this.limit,
      remaining: Math.max(0, this.limit - bucket.count),
      resetAt: bucket.resetAt,
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    };
  }
}

export function rateLimitHeaders(result) {
  return {
    'x-ratelimit-limit': String(result.limit),
    'x-ratelimit-remaining': String(result.remaining),
    'x-ratelimit-reset': String(Math.ceil(result.resetAt / 1000)),
    ...(result.retryAfterSeconds ? { 'retry-after': String(result.retryAfterSeconds) } : {})
  };
}
