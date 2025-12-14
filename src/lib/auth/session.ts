import { nanoid } from 'nanoid';

const SESSIONS = new Map<string, { userId: string; expiresAt: Date }>();

export function createSession(userId: string): string {
  const sessionId = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  SESSIONS.set(sessionId, { userId, expiresAt });
  
  // Clean up expired sessions
  for (const [id, session] of SESSIONS.entries()) {
    if (session.expiresAt < new Date()) {
      SESSIONS.delete(id);
    }
  }
  
  return sessionId;
}

export function validateSession(sessionId: string): string | null {
  const session = SESSIONS.get(sessionId);
  
  if (!session || session.expiresAt < new Date()) {
    SESSIONS.delete(sessionId);
    return null;
  }
  
  return session.userId;
}

export function destroySession(sessionId: string) {
  SESSIONS.delete(sessionId);
}