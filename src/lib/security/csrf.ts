import { nanoid } from 'nanoid';

export function generateCsrfToken(): string {
  return nanoid(32);
}

export function verifyCsrfToken(token: string, storedToken: string): boolean {
  return token === storedToken;
}

// In API routes:
export async function POST(request: NextRequest) {
  const csrfToken = request.headers.get('x-csrf-token');
  const storedToken = request.cookies.get('csrf-token')?.value;
  
  if (!csrfToken || !storedToken || csrfToken !== storedToken) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  
  // Process request...
}