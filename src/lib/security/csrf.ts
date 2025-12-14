// src/lib/security/csrf.ts
import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server'; // FIX: Imported NextRequest and NextResponse

/**
 * Generates a new, cryptographically strong CSRF token (32 characters).
 * @returns A 32-character nanoid string.
 */
export function generateCsrfToken(): string {
  return nanoid(32);
}

/**
 * Verifies if the token provided in the request matches the token stored in the cookie.
 * @param token The token received from the request header ('x-csrf-token').
 * @param storedToken The token retrieved from the user's cookie ('csrf-token').
 * @returns True if tokens match, false otherwise.
 */
export function verifyCsrfToken(token: string, storedToken: string): boolean {
  return token === storedToken;
}

// In API routes:
/**
 * Example handler showing how to enforce CSRF protection in a Next.js API route.
 * @param request The incoming NextRequest object.
 */
export async function POST(request: NextRequest) {
  const csrfToken = request.headers.get('x-csrf-token');
  const storedToken = request.cookies.get('csrf-token')?.value;
  
  // Use the verification utility for clarity (though direct check is fine)
  const isValid = csrfToken && storedToken && verifyCsrfToken(csrfToken, storedToken);

  if (!isValid) {
    // FIX: Using NextResponse from the new import
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  
  // Process request...
  return NextResponse.json({ message: 'Request processed successfully' });
}