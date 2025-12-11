// src/lib/api/rate-limit-middleware.ts
// Production-ready rate limiting middleware using Upstash Redis

import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client (cached to avoid reconnections)
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

// Rate limiter instances (singleton pattern)
const rateLimiters = {
  // Authentication: 5 attempts per 15 minutes
  auth: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),
  
  // Registration: 3 attempts per hour
  register: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    analytics: true,
    prefix: 'ratelimit:register',
  }),
  
  // General API: 100 per minute
  api: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'ratelimit:api',
  }),
  
  // Job creation: 5 per day
  createJob: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(5, '24 h'),
    analytics: true,
    prefix: 'ratelimit:create_job',
  }),
  
  // Service creation: 10 per hour
  createService: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    analytics: true,
    prefix: 'ratelimit:create_service',
  }),
  
  // Proposal submission: 20 per day
  submitProposal: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(20, '24 h'),
    analytics: true,
    prefix: 'ratelimit:proposal',
  }),
  
  // Payment initiation: 5 per hour
  initiatePayment: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    analytics: true,
    prefix: 'ratelimit:payment',
  }),

  // File uploads: 20 per hour
  fileUpload: new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    analytics: true,
    prefix: 'ratelimit:upload',
  }),
};

export type RateLimiterType = keyof typeof rateLimiters;

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
 * Usage:
 * 
 * export async function POST(request: NextRequest) {
 *   const rateLimitResponse = await withRateLimit('createJob', request);
 *   if (rateLimitResponse) return rateLimitResponse;
 *   
 *   // Your API logic here
 * }
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
    const prefix = rateLimiters[limiterType].prefix || 'ratelimit';
    const key = `${prefix}:${identifier}`;
    
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Rate limit reset error:', error);
    return false;
  }
}