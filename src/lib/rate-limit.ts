const MAX_TOKENS = 60;
const REFILL_RATE_MS = 1000; // 1 token per second
const WINDOW_MS = 60_000; // 60 seconds
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_AGE_MS = 10 * 60 * 1000; // 10 minutes

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
  if (cleanupInterval !== null) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    buckets.forEach((bucket, key) => {
      if (now - bucket.lastRefill > STALE_AGE_MS) {
        buckets.delete(key);
      }
    });
  }, CLEANUP_INTERVAL_MS);
}

export function checkRateLimit(identifier: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  ensureCleanup();

  const now = Date.now();
  let bucket = buckets.get(identifier);

  if (!bucket) {
    bucket = { tokens: MAX_TOKENS - 1, lastRefill: now };
    buckets.set(identifier, bucket);
    return {
      allowed: true,
      remaining: MAX_TOKENS - 1,
      resetAt: now + WINDOW_MS,
    };
  }

  const elapsed = now - bucket.lastRefill;
  const tokensToAdd = Math.floor(elapsed / REFILL_RATE_MS);
  bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      remaining: bucket.tokens,
      resetAt: now + WINDOW_MS,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    resetAt: now + WINDOW_MS,
  };
}

export function getRateLimitHeaders(
  result: ReturnType<typeof checkRateLimit>
): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}
