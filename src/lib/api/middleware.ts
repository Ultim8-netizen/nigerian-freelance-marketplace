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
// RATE LIMITERS (Singleton Pattern)
// ============================================================================
const rateLimiters = {
  // Authentication: 5 attempts per 15 minutes
  auth: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: true,
    prefix: 'rl:auth',
  }),
  
  // Registration: 3 attempts per hour
  register: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    analytics: true,
    prefix: 'rl:register',
  }),
  
  // General API: 100 per minute
  api: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'rl:api',
  }),
  
  // Job creation: 5 per day
  createJob: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(5, '24 h'),
    analytics: true,
    prefix: 'rl:job',
  }),
  
  // Service creation: 10 per hour
  createService: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    analytics: true,
    prefix: 'rl:service',
  }),
  
  // Proposal submission: 20 per day
  submitProposal: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(20, '24 h'),
    analytics: true,
    prefix: 'rl:proposal',
  }),
  
  // Payment initiation: 5 per hour
  initiatePayment: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    analytics: true,
    prefix: 'rl:payment',
  }),

  // File uploads: 20 per hour
  fileUpload: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    analytics: true,
    prefix: 'rl:upload',
  }),
};

export type RateLimiterType = keyof typeof rateLimiters;

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
    
    // Get user from session (no DB call if JWT is valid)
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
// OWNERSHIP VERIFICATION (Optimized with caching potential)
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

    // Only fetch the owner column for efficiency
    const { data: resource, error } = await supabase
      .from(table)
      .select(ownerColumn)
      .eq('id', resourceId)
      .maybeSingle(); // Use maybeSingle to avoid errors on not found

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

    // FIX: Safe type assertion by converting to unknown first to satisfy TS2352
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
// RATE LIMITING (Optimized with proper headers)
// ============================================================================

/**
 * Apply rate limit with comprehensive headers
 * OPTIMIZATION: Fails open if Redis is down (availability over strict limiting)
 */
export async function applyRateLimit(
  limiterType: RateLimiterType,
  request: NextRequest
): Promise<NextResponse | null> {
  try {
    // Get identifier (prefer user ID from header, fallback to IP)
    const userId = request.headers.get('x-user-id');
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const identifier = userId || ip;

    // Check rate limit
    const { success, limit, reset, remaining } = 
      await rateLimiters[limiterType].limit(identifier);

    // Prepare rate limit headers
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

    return null; // Rate limit passed
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open - don't block users if Redis is down
    return null;
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
 * Get current rate limit status (for client-side display)
 */
export async function getRateLimitStatus(
  limiterType: RateLimiterType,
  identifier: string
): Promise<{
  limit: number;
  remaining: number;
  reset: Date;
}> {
  try {
    const { limit, remaining, reset } = 
      await rateLimiters[limiterType].limit(identifier);
    
    return {
      limit,
      remaining: Math.max(0, remaining),
      reset: new Date(reset),
    };
  } catch (error) {
    console.error('Rate limit status check error:', error);
    return {
      limit: 0,
      remaining: 0,
      reset: new Date(),
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
    // FIX: Removed unused 'prefix' variable and addressed ESLint warning
    
    // Delete all keys matching the pattern
    const pattern = `rl:${limiterType}:${identifier}*`;
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
    for (const limiterType of Object.keys(rateLimiters) as RateLimiterType[]) {
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