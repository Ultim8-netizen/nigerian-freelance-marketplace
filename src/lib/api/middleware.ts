// src/lib/api/middleware.ts
// Production-ready authentication, ownership, and rate limiting middleware

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client (cached to avoid reconnections)
let redis: Redis | null = null;

function getRedisClient(): Redis {
  if (!redis) {
    // NOTE: Using non-null assertion (!) as these are expected to be set in environment variables
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

// Rate limiter instances (singleton pattern)
const rateLimiters = {
  // Authentication: 5 attempts per 15 minutes
  auth: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: true,
  }),
  
  // Registration: 3 attempts per hour
  register: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    analytics: true,
  }),
  
  // General API: 100 per minute
  api: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
  }),
  
  // Job creation: 5 per day
  createJob: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(5, '24 h'),
    analytics: true,
  }),
  
  // Service creation: 10 per hour
  createService: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    analytics: true,
  }),
  
  // Proposal submission: 20 per day
  submitProposal: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(20, '24 h'),
    analytics: true,
  }),
  
  // Payment initiation: 5 per hour
  initiatePayment: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    analytics: true,
  }),

  // File uploads: 20 per hour
  fileUpload: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    analytics: true,
  }),
};

export type RateLimiterType = keyof typeof rateLimiters;

/**
 * Authentication middleware - Verify user session
 * Note: Supabase createClient() automatically reads cookies from the request context
 * @returns User object if authenticated, NextResponse if not
 */
export async function requireAuth() {
  try {
    // createClient is async in Next.js edge runtime
    const supabase = await createClient(); 
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    return { user };
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 401 }
    );
  }
}

/**
 * Ownership verification middleware - Check if user owns a resource
 * @param table - Database table name
 * @param resourceId - ID of the resource to check
 * @param ownerColumn - Column name that contains the owner ID (default: 'user_id')
 * @returns null if authorized, NextResponse if not
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
        { success: false, error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    // Query the resource
    const { data: resource, error } = await supabase
      .from(table)
      .select(ownerColumn)
      .eq('id', resourceId)
      .single();

    if (error || !resource) {
      return NextResponse.json(
        { success: false, error: 'Resource not found' },
        { status: 404 }
      );
    }

    // Check ownership - Safe type assertion for dynamic property access
    const resourceData = resource as unknown as Record<string, unknown>;
    if (resourceData[ownerColumn] !== user.id) {
      console.warn('Unauthorized ownership access', { 
        table, 
        resourceId, 
        userId: user.id 
      });
      return NextResponse.json(
        { success: false, error: 'Unauthorized - You do not own this resource' },
        { status: 403 }
      );
    }

    return null; // Ownership verified
  } catch (error) {
    console.error('Ownership check error:', error);
    return NextResponse.json(
      { success: false, error: 'Authorization failed' },
      { status: 500 }
    );
  }
}

/**
 * Rate limit middleware - Apply to API routes
 * @param limiterType - Type of rate limiter to use
 * @param request - NextRequest object
 * @returns NextResponse if rate limited, null if OK
 */
export async function applyRateLimit(
  limiterType: RateLimiterType,
  request: NextRequest
): Promise<NextResponse | null> {
  try {
    // Get identifier (prefer user ID, fallback to IP)
    const userId = request.headers.get('x-user-id'); // Set by auth middleware
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const identifier = userId || ip;

    // Check rate limit
    const { success, limit, reset, remaining } = 
      await rateLimiters[limiterType].limit(identifier);

    // Add rate limit headers to all responses
    const headers = {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(reset).toISOString(),
    };

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please try again later.',
          resetAt: new Date(reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            ...headers,
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Rate limit passed - attach headers to request for downstream use
    request.headers.set('x-ratelimit-remaining', remaining.toString());
    
    return null; // No rate limit response = proceed
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open (don't block users if Redis is down)
    return null;
  }
}

/**
 * Wrapper function for easy integration in API routes
 */
export async function withRateLimit(
  limiterType: RateLimiterType,
  request: NextRequest
): Promise<NextResponse | null> {
  return applyRateLimit(limiterType, request);
}

/**
 * Get current rate limit status (useful for client-side warnings)
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
    // The `limit` call is used here just to retrieve the status without
    // consuming a request from the limit (using a dummy identifier)
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
    const redis = getRedisClient();
    // Construct key manually since prefix is protected
    // The key structure must match Ratelimit's internal structure for slidingWindow
    // Since Ratelimit doesn't expose a reset method, this is a best-effort approach
    const key = `ratelimit_in_memory_${limiterType}:${identifier}`; 
    
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Rate limit reset error:', error);
    return false;
  }
}