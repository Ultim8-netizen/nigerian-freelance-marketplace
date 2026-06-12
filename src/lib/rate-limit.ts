// src/lib/rate-limit.ts
// DEV-ONLY in-memory rate limiter.
//
// PRODUCTION: This limiter resets on every cold start (serverless — no shared
// process memory across invocations). It provides zero protection in production.
// Use src/lib/rate-limit-upstash.ts for all production rate limiting.
//
// The module-level guard below makes accidental production use a hard startup
// failure rather than a silent no-op.

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    '[rate-limit.ts] In-memory rate limiter is not safe in serverless/production. ' +
    'Import from src/lib/rate-limit-upstash.ts instead. ' +
    'If you see this error in a route handler, replace the import.'
  );
}

const rateLimitMap = new Map<string, number[]>();

export function rateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(identifier) || [];
  const recentRequests = requests.filter(time => now - time < windowMs);

  if (recentRequests.length >= maxRequests) return false;

  recentRequests.push(now);
  rateLimitMap.set(identifier, recentRequests);

  // Cleanup: fires when unique-identifier count (not total entries) exceeds 100.
  // Intent is memory pressure management, not a strict threshold.
  if (rateLimitMap.size > 100) {
    for (const [key, times] of rateLimitMap.entries()) {
      if (times.filter(t => now - t < windowMs).length === 0) {
        rateLimitMap.delete(key);
      }
    }
  }

  return true;
}