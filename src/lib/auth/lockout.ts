const loginAttempts = new Map<string, { count: number; lockedUntil?: Date }>();

/**
 * Checks if a user's login attempts are currently locked out.
 * @param email The user's email address.
 * @returns true if login is allowed, false if the account is locked.
 */
export function checkLoginLockout(email: string): boolean {
  const attempt = loginAttempts.get(email);
  
  // No previous attempts recorded, allow login
  if (!attempt) return true; 
  
  // Check if the lockout period has expired
  if (attempt.lockedUntil && attempt.lockedUntil > new Date()) {
    return false; // Locked
  }
  
  // If count is >= 5 and lockout time passed, reset the lock, but check count again
  if (attempt.count >= 5) {
    // Lock for 15 minutes
    attempt.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    return false;
  }
  
  return true;
}

/**
 * Records a failed login attempt for the specified email.
 * @param email The user's email address.
 */
export function recordFailedLogin(email: string) {
  const attempt = loginAttempts.get(email) || { count: 0 };
  attempt.count += 1;
  loginAttempts.set(email, attempt);
}

/**
 * Resets the login attempt count and removes any active lockout for the email.
 * Should be called upon successful login.
 * @param email The user's email address.
 */
export function resetLoginAttempts(email: string) {
  loginAttempts.delete(email);
}

/*
// Usage in login route example (needs to be inside an actual function or route handler):

// 1. Check before processing login attempt (assuming 'email' is defined from the request body, and you've imported NextResponse from 'next/server'):
if (!checkLoginLockout(email)) {
  return NextResponse.json(
    { error: 'Account temporarily locked. Try again in 15 minutes.' },
    { status: 429 }
  );
}

// 2. After failed login:
recordFailedLogin(email);

// 3. After successful login:
resetLoginAttempts(email);
*/