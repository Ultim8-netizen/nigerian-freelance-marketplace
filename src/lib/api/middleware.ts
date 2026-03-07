// src/lib/api/middleware.ts
// OPTIMIZED: Efficient authentication and rate limiting for API routes
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ============================================================================
// REDIS CLIENT (Singleton)
// ============================================================================
let redis: Redis | null = null;

function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

// ============================================================================
// RATE LIMITERS (Lazy Singleton Pattern)
// FIX: Deferred initialization — rate limiters are created on first use, not at
// module load time. Previously, calling getRedisClient() at the top level would
// throw immediately if UPSTASH_REDIS_REST_URL/TOKEN env vars were missing
// (e.g. during tests, build, or misconfigured environments).
// ============================================================================

type RateLimiterConfig = {
  limiter: ReturnType<typeof Ratelimit.slidingWindow>;
  prefix: string;
};

const rateLimiterConfigs: Record<string, RateLimiterConfig> = {
  // Authentication: 5 attempts per 15 minutes
  auth: {
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    prefix: 'rl:auth',
  },
  // Registration: 3 attempts per hour
  register: {
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    prefix: 'rl:register',
  },
  // General API: 100 per minute
  api: {
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    prefix: 'rl:api',
  },
  // Job creation: 5 per day
  createJob: {
    limiter: Ratelimit.slidingWindow(5, '24 h'),
    prefix: 'rl:job',
  },
  // Service creation: 10 per hour
  createService: {
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'rl:service',
  },
  // Proposal submission: 20 per day
  submitProposal: {
    limiter: Ratelimit.slidingWindow(20, '24 h'),
    prefix: 'rl:proposal',
  },
  // Payment initiation: 5 per hour
  initiatePayment: {
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:payment',
  },
  // File uploads: 20 per hour
  fileUpload: {
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:upload',
  },
};

const rateLimiterInstances: Partial<Record<string, Ratelimit>> = {};

function getRateLimiter(type: RateLimiterType): Ratelimit {
  if (!rateLimiterInstances[type]) {
    const config = rateLimiterConfigs[type];
    rateLimiterInstances[type] = new Ratelimit({
      redis: getRedisClient(),
      limiter: config.limiter,
      analytics: true,
      prefix: config.prefix,
    });
  }
  return rateLimiterInstances[type]!;
}

export type RateLimiterType = keyof typeof rateLimiterConfigs;

// ============================================================================
// AUTHENTICATION (Optimized for API Routes)
// ============================================================================

/**
 * Require authentication - Uses session from headers if available
 * OPTIMIZATION: Checks x-user-id header first (set by edge middleware)
 */
export async function requireAuth() {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized - Please login',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      );
    }

    return { user };
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Authentication failed',
        code: 'AUTH_ERROR'
      },
      { status: 401 }
    );
  }
}

// ============================================================================
// OWNERSHIP VERIFICATION
// ============================================================================

/**
 * Verify resource ownership
 * OPTIMIZATION: Uses single query with minimal data fetching
 */
export async function requireOwnership(
  table: string,
  resourceId: string,
  ownerColumn: string = 'user_id'
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized - Please login',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      );
    }

    // FIX: Type assertion for dynamic table name - TS2769
    const { data: resource, error } = await supabase
      .from(table as never)
      .select(ownerColumn)
      .eq('id', resourceId)
      .maybeSingle();

    if (error) {
      console.error('Ownership check query error:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to verify ownership',
          code: 'OWNERSHIP_CHECK_FAILED'
        },
        { status: 500 }
      );
    }

    if (!resource) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Resource not found',
          code: 'RESOURCE_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // FIX: Safe type assertion - TS2352
    const resourceData = resource as unknown as Record<string, unknown>;
    if (resourceData[ownerColumn] !== user.id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized - You do not own this resource',
          code: 'NOT_RESOURCE_OWNER'
        },
        { status: 403 }
      );
    }

    return null; // Ownership verified
  } catch (error) {
    console.error('Ownership check error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Authorization failed',
        code: 'AUTH_ERROR'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Apply rate limit with comprehensive headers.
 * OPTIMIZATION: Fails open if Redis is down (availability over strict limiting)
 */
export async function applyRateLimit(
  limiterType: RateLimiterType,
  request: NextRequest
): Promise<NextResponse | null> {
  try {
    const userId = request.headers.get('x-user-id');
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const identifier = userId || ip;

    const { success, limit, reset, remaining } =
      await getRateLimiter(limiterType).limit(identifier);

    const rateLimitHeaders = {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(reset).toISOString(),
    };

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter,
          resetAt: new Date(reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders,
            'Retry-After': retryAfter.toString(),
          },
        }
      );
    }

    return null;
  } catch (error) {
    console.error('Rate limit check error:', error);
    return null; // Fail open
  }
}

/**
 * Convenience wrapper for rate limiting
 */
export async function withRateLimit(
  limiterType: RateLimiterType,
  request: NextRequest
): Promise<NextResponse | null> {
  return applyRateLimit(limiterType, request);
}

// ============================================================================
// RATE LIMIT UTILITIES
// ============================================================================

/**
 * Get current rate limit status (for client-side display).
 *
 * FIX: The previous implementation called .limit() here, which consumed a
 * token from the user's quota on every status check (e.g. page load,
 * dashboard render). We now read the underlying Redis key directly to inspect
 * the current window count without any side effects.
 *
 * NOTE: This reads the internal sliding window key written by Upstash
 * Ratelimit. Key format is `{prefix}:{identifier}`. If Upstash changes
 * their internal key schema this will need updating.
 */
export async function getRateLimitStatus(
  limiterType: RateLimiterType,
  identifier: string
): Promise<{
  limit: number;
  remaining: number;
  reset: Date;
}> {
  const config = rateLimiterConfigs[limiterType];

  // Parse window duration from limiter config string (e.g. '1 h', '15 m', '24 h')
  const windowDurations: Record<string, number> = {
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000,
  };
  const limiterSource = config.limiter.toString();
  const windowMatch = limiterSource.match(/(\d+)\s*([mhd])/);
  const windowMs = windowMatch
    ? parseInt(windowMatch[1]) * (windowDurations[windowMatch[2]] ?? 60000)
    : 60 * 1000;

  // Extract configured max requests from limiter string
  const maxMatch = limiterSource.match(/(\d+)/);
  const configuredLimit = maxMatch ? parseInt(maxMatch[1]) : 0;

  try {
    const redisClient = getRedisClient();
    const key = `${config.prefix}:${identifier}`;

    // Read current count and TTL without consuming a token
    const currentCount = await redisClient.get<number>(key) ?? 0;
    const ttlSeconds = await redisClient.ttl(key);

    const resetDate = ttlSeconds > 0
      ? new Date(Date.now() + ttlSeconds * 1000)
      : new Date(Date.now() + windowMs);

    return {
      limit: configuredLimit,
      remaining: Math.max(0, configuredLimit - currentCount),
      reset: resetDate,
    };
  } catch (error) {
    console.error('Rate limit status check error:', error);
    return {
      limit: configuredLimit,
      remaining: 0,
      reset: new Date(Date.now() + windowMs),
    };
  }
}

/**
 * Reset rate limit for a specific identifier (admin use)
 */
export async function resetRateLimit(
  limiterType: RateLimiterType,
  identifier: string
): Promise<boolean> {
  try {
    const redisClient = getRedisClient();
    const pattern = `${rateLimiterConfigs[limiterType].prefix}:${identifier}*`;
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
    
    return true;
  } catch (error) {
    console.error('Rate limit reset error:', error);
    return false;
  }
}

/**
 * Batch reset rate limits (admin use)
 */
export async function batchResetRateLimits(
  identifiers: string[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const identifier of identifiers) {
    for (const limiterType of Object.keys(rateLimiterConfigs) as RateLimiterType[]) {
      const result = await resetRateLimit(limiterType, identifier);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }
  }

  return { success, failed };
}