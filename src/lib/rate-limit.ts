// Simple in-memory rate limiter
const rateLimitMap = new Map<string, number[]>();

export function rateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(identifier) || [];
  
  // Filter requests within window
  const recentRequests = requests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false; // Rate limited
  }
  
  recentRequests.push(now);
  rateLimitMap.set(identifier, recentRequests);
  
  // Cleanup old entries (every 100 requests)
  if (rateLimitMap.size > 100) {
    for (const [key, times] of rateLimitMap.entries()) {
      const validTimes = times.filter(t => now - t < windowMs);
      if (validTimes.length === 0) {
        rateLimitMap.delete(key);
      }
    }
  }
  
  return true;
}

// Usage in API routes:
// if (!rateLimit(user.id, 5, 60000)) {
//   return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
// }