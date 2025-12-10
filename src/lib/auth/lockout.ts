//src/lib/auth/lockout.ts

const loginAttempts = new Map<string, { count: number; lockedUntil?: Date }>();

export function checkLoginLockout(email: string): boolean {
  const attempt = loginAttempts.get(email);
  
  if (!attempt) return true; // Allow
  
  if (attempt.lockedUntil && attempt.lockedUntil > new Date()) {
    return false; // Locked
  }
  
  if (attempt.count >= 5) {
    // Lock for 15 minutes
    attempt.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    return false;
  }
  
  return true;
}

export function recordFailedLogin(email: string) {
  const attempt = loginAttempts.get(email) || { count: 0 };
  attempt.count += 1;
  loginAttempts.set(email, attempt);
}

export function resetLoginAttempts(email: string) {
  loginAttempts.delete(email);
}

// Usage in login route:
if (!checkLoginLockout(email)) {
  return NextResponse.json(
    { error: 'Account temporarily locked. Try again in 15 minutes.' },
    { status: 429 }
  );
}

// After failed login:
recordFailedLogin(email);

// After successful login:
resetLoginAttempts(email);