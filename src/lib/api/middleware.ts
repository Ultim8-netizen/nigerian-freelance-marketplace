// src/lib/api/middleware.ts
// Rate limiting infrastructure for API routes.
//
// BREAKING CHANGE: requireAuth() and requireOwnership() previously exported
// from this file have been removed. They had incompatible signatures with the
// canonical implementations in enhanced-middleware.ts:
//
//   middleware.ts:          requireAuth()                 — no args, creates own client
//   enhanced-middleware.ts: requireAuth(request, supabase) — shared client pattern
//
// Two implementations of the same function in the same logical module creates
// silent divergence risk. The enhanced-middleware.ts versions are canonical.
//
// Migration: replace
//   import { requireAuth, requireOwnership } from '@/lib/api/middleware'
// with
//   import { requireAuth, requireOwnership } from '@/lib/api/enhanced-middleware'
//
// This file now owns only: Redis client, rate limiter config, applyRateLimit,
// getRateLimitStatus, resetRateLimit, batchResetRateLimits, RateLimiterType.

import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ============================================================================
// REDIS CLIENT (Lazy Singleton)
// Env vars are read at first call, not at module load, so missing vars do not
// crash the process on routes that never touch the rate limiter.
// ============================================================================

let redis: Redis | null = null;

function getRedisClient(): Redis {
  if (!redis) {
    const url   = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        '[getRedisClient] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN ' +
        'must be set. Add them to .env.local (never prefix with NEXT_PUBLIC_).'
      );
    }

    redis = new Redis({ url, token });
  }
  return redis;
}

// ============================================================================
// WINDOW PARSING UTILITY
// ============================================================================

const _WINDOW_UNIT_MS: Record<string, number> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

function parseWindowMs(window: string): number {
  const match = window.trim().match(/^(\d+)\s*([mhd])$/i);
  if (!match) return 60_000;
  return parseInt(match[1]) * (_WINDOW_UNIT_MS[match[2].toLowerCase()] ?? 60_000);
}

// ============================================================================
// RATE LIMITER CONFIGS
//
// FIX: maxRequests and window are now stored as explicit fields alongside the
// limiter instance. The previous getRateLimitStatus called config.limiter.toString()
// and tried to regex-extract limit count and window duration from the result.
// Ratelimit.slidingWindow() returns a function object — .toString() produces
// '[object Object]'. Both regex matches failed silently:
//   configuredLimit → 0  (maxMatch null)
//   windowMs        → 60_000 (windowMatch null, default applied)
// Every getRateLimitStatus call returned { limit: 0, remaining: 0, ... }.
// ============================================================================

type RateLimiterConfig = {
  maxRequests: number;
  window:      string; // e.g. '15 m', '1 h', '24 h' — must match Ratelimit.slidingWindow arg
  limiter:     ReturnType<typeof Ratelimit.slidingWindow>;
  prefix:      string;
};

const rateLimiterConfigs = {
  auth: {
    maxRequests: 5,   window: '15 m',
    limiter: Ratelimit.slidingWindow(5,   '15 m'), prefix: 'rl:auth',
  },
  register: {
    maxRequests: 3,   window: '1 h',
    limiter: Ratelimit.slidingWindow(3,   '1 h'),  prefix: 'rl:register',
  },
  api: {
    maxRequests: 100, window: '1 m',
    limiter: Ratelimit.slidingWindow(100, '1 m'),  prefix: 'rl:api',
  },
  createJob: {
    maxRequests: 5,   window: '24 h',
    limiter: Ratelimit.slidingWindow(5,   '24 h'), prefix: 'rl:job',
  },
  createService: {
    maxRequests: 10,  window: '1 h',
    limiter: Ratelimit.slidingWindow(10,  '1 h'),  prefix: 'rl:service',
  },
  submitProposal: {
    maxRequests: 20,  window: '24 h',
    limiter: Ratelimit.slidingWindow(20,  '24 h'), prefix: 'rl:proposal',
  },
  initiatePayment: {
    maxRequests: 5,   window: '1 h',
    limiter: Ratelimit.slidingWindow(5,   '1 h'),  prefix: 'rl:payment',
  },
  fileUpload: {
    maxRequests: 20,  window: '1 h',
    limiter: Ratelimit.slidingWindow(20,  '1 h'),  prefix: 'rl:upload',
  },
} satisfies Record<string, RateLimiterConfig>;

export type RateLimiterType = keyof typeof rateLimiterConfigs;

// ============================================================================
// RATE LIMITER INSTANCES (Lazy)
// ============================================================================

const rateLimiterInstances = new Map<RateLimiterType, Ratelimit>();

function getRateLimiter(type: RateLimiterType): Ratelimit {
  if (!rateLimiterInstances.has(type)) {
    const config = rateLimiterConfigs[type];
    rateLimiterInstances.set(type, new Ratelimit({
      redis:     getRedisClient(),
      limiter:   config.limiter,
      analytics: true,
      prefix:    config.prefix,
    }));
  }
  return rateLimiterInstances.get(type)!;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Apply rate limit and return a 429 NextResponse if the limit is exceeded,
 * or null if the request is within quota.
 *
 * Identifier precedence:
 *   1. `userId` param — always pass this for auth-required routes. Nigerian
 *      mobile carriers and campus networks commonly share a single egress IP;
 *      per-IP limiting would exhaust one user's quota for all users behind
 *      that IP. Per-user limiting is the correct model for authenticated ops.
 *   2. `x-user-id` header — set by root middleware.ts when a session is
 *      present; available here if the edge middleware ran before this handler.
 *   3. IP address — correct fallback for pre-auth and public routes.
 *
 * Fails open if Redis is unreachable (availability over strict limiting).
 */
export async function applyRateLimit(
  limiterType: RateLimiterType,
  request: NextRequest,
  userId?: string
): Promise<NextResponse | null> {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const identifier =
      userId ||
      request.headers.get('x-user-id') ||
      ip;

    const { success, limit, reset, remaining } =
      await getRateLimiter(limiterType).limit(identifier);

    const rateLimitHeaders = {
      'X-RateLimit-Limit':     limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset':     new Date(reset).toISOString(),
    };

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        {
          success:   false,
          error:     'Too many requests. Please try again later.',
          code:      'RATE_LIMIT_EXCEEDED',
          retryAfter,
          resetAt:   new Date(reset).toISOString(),
        },
        {
          status: 429,
          headers: { ...rateLimitHeaders, 'Retry-After': retryAfter.toString() },
        }
      );
    }

    return null;
  } catch (error) {
    console.error('Rate limit check error:', error);
    return null; // Fail open — Redis outage should not take down the API
  }
}

// ============================================================================
// RATE LIMIT STATUS (read-only — no token consumed)
// ============================================================================

/**
 * Returns the current rate limit state for an identifier without consuming a
 * token. Reads the underlying Redis key directly rather than calling .limit().
 *
 * NOTE: Key format is `{prefix}:{identifier}` which matches Upstash Ratelimit's
 * internal sliding window schema. Monitor @upstash/ratelimit changelogs if the
 * library is upgraded — internal key naming is not part of the public API.
 */
export async function getRateLimitStatus(
  limiterType: RateLimiterType,
  identifier:  string
): Promise<{ limit: number; remaining: number; reset: Date }> {
  const config    = rateLimiterConfigs[limiterType];
  const windowMs  = parseWindowMs(config.window);

  try {
    const client = getRedisClient();
    const key    = `${config.prefix}:${identifier}`;

    const currentCount = await client.get<number>(key) ?? 0;
    const ttlSeconds   = await client.ttl(key);

    const reset = ttlSeconds > 0
      ? new Date(Date.now() + ttlSeconds * 1000)
      : new Date(Date.now() + windowMs);

    return {
      limit:     config.maxRequests,
      remaining: Math.max(0, config.maxRequests - currentCount),
      reset,
    };
  } catch (error) {
    console.error('Rate limit status check error:', error);
    // Fail safe: return zero remaining so UI shows the locked state rather
    // than a falsely optimistic count on a Redis error.
    return {
      limit:     config.maxRequests,
      remaining: 0,
      reset:     new Date(Date.now() + windowMs),
    };
  }
}

// ============================================================================
// ADMIN UTILITIES
// ============================================================================

/**
 * Delete all rate limit keys for a specific identifier and limiter type.
 * Admin use only — does not require a session by design (called from admin routes).
 */
export async function resetRateLimit(
  limiterType: RateLimiterType,
  identifier:  string
): Promise<boolean> {
  try {
    const client  = getRedisClient();
    const pattern = `${rateLimiterConfigs[limiterType].prefix}:${identifier}*`;
    const keys    = await client.keys(pattern);
    if (keys.length > 0) await client.del(...keys);
    return true;
  } catch (error) {
    console.error('Rate limit reset error:', error);
    return false;
  }
}

/**
 * Reset all limiter types for a batch of identifiers.
 * Sequential by design — this is an infrequent admin operation; parallelism
 * would flood Redis connections for negligible throughput gain.
 */
export async function batchResetRateLimits(
  identifiers: string[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed  = 0;

  for (const identifier of identifiers) {
    for (const type of Object.keys(rateLimiterConfigs) as RateLimiterType[]) {
      const ok = await resetRateLimit(type, identifier);
      ok ? success++ : failed++;
    }
  }

  return { success, failed };
}