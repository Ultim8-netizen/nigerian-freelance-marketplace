// src/lib/rate-limit-upstash.ts
// Production-ready rate limiting using Upstash Redis

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limiters for different operations
export const rateLimiters = {
  // Authentication: 5 attempts per 15 minutes
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),
  
  // Registration: 3 attempts per hour
  register: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    analytics: true,
    prefix: 'ratelimit:register',
  }),
  
  // API calls: 100 per minute
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'ratelimit:api',
  }),
  
  // Job creation: 5 per day
  createJob: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '24 h'),
    analytics: true,
    prefix: 'ratelimit:create_job',
  }),
  
  // Service creation: 10 per hour
  createService: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    analytics: true,
    prefix: 'ratelimit:create_service',
  }),
  
  // Proposal submission: 20 per day
  submitProposal: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '24 h'),
    analytics: true,
    prefix: 'ratelimit:proposal',
  }),
  
  // Payment initiation: 5 per hour
  initiatePayment: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    analytics: true,
    prefix: 'ratelimit:payment',
  }),
};

/**
 * Apply rate limit check
 * Returns: { success: true } or { success: false, reset: Date }
 */
export async function checkRateLimit(
  limiterType: keyof typeof rateLimiters,
  identifier: string
) {
  try {
    const { success, limit, reset, remaining } = await rateLimiters[limiterType].limit(identifier);
    
    return {
      success,
      limit,
      remaining,
      reset: new Date(reset),
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open in case of Redis error (don't block users)
    return { success: true, limit: 0, remaining: 0, reset: new Date() };
  }
}

/**
 * Usage in API route:
 * 
 * import { checkRateLimit } from '@/lib/rate-limit-upstash';
 * 
 * export async function POST(request: NextRequest) {
 *   const ip = request.headers.get('x-forwarded-for') || 'unknown';
 *   const rateLimitResult = await checkRateLimit('api', ip);
 *   
 *   if (!rateLimitResult.success) {
 *     return NextResponse.json(
 *       { 
 *         error: 'Too many requests', 
 *         resetAt: rateLimitResult.reset 
 *       },
 *       { status: 429 }
 *     );
 *   }
 *   
 *   // ... rest of your logic
 * }
 */

// Install dependency:
// npm install @upstash/ratelimit @upstash/redis