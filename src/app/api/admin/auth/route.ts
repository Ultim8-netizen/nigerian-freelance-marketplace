// src/app/api/admin/auth/route.ts
// Server-side admin credential validation with IP-based rate limiting and
// email alert on limit breach.
//
// Responsibility boundary:
//   THIS ROUTE  — rate limit by IP, signInWithPassword, TOTP factor check,
//                 email notification when limit is breached.
//   CLIENT      — mfa.challenge() and mfa.verify() after this route responds,
//                 using the session cookies set here.
//
// The session established by signInWithPassword is written to HttpOnly cookies
// by the Supabase SSR server client. The browser Supabase client reads those
// same cookies, so mfa.challenge() / mfa.verify() work normally on the client
// immediately after this route returns.

import { NextRequest, NextResponse } from 'next/server';
import { createClient }                from '@/lib/supabase/server';
import { redis, checkRateLimit }       from '@/lib/rate-limit-upstash';
import { logger }                      from '@/lib/logger';
import { z }                           from 'zod';

const adminAuthSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

// Destination for breach alerts — matches the address used in support/contact
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL ?? 'eldergod263@gmail.com';

// Redis key pattern for per-IP notification deduplication.
// TTL matches the adminLogin rate-limit window (15 min) so the admin receives
// exactly one email per IP per window, even if the endpoint is hammered.
const notifKey = (ip: string) => `admin_login_block_notified:${ip}`;

export async function POST(request: NextRequest) {
  // ── 1. Extract client IP ──────────────────────────────────────────────────
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // ── 2. Rate limit check ───────────────────────────────────────────────────
  // Every call — success or failure — counts against the window.
  // This is intentional: we want to limit total attempts, not just failures,
  // so an attacker cannot probe with a correct password at attempt #4+.
  const rateLimit = await checkRateLimit('adminLogin', ip);

  if (!rateLimit.success) {
    // Send one alert email per IP per 15-minute window
    await sendBlockAlertIfNeeded(ip);

    logger.warn('Admin login rate limit breached', { ip });

    return NextResponse.json(
      {
        success:  false,
        error:    'Too many login attempts. Access from this IP is temporarily blocked.',
        code:     'ADMIN_LOGIN_RATE_LIMITED',
        resetAt:  rateLimit.reset,
      },
      { status: 429 }
    );
  }

  // ── 3. Validate request body ──────────────────────────────────────────────
  let validated: z.infer<typeof adminAuthSchema>;
  try {
    const body = await request.json();
    validated  = adminAuthSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 }
    );
  }

  // ── 4. Authenticate credentials ───────────────────────────────────────────
  const supabase = await createClient();

  const { data: authData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email:    validated.email,
      password: validated.password,
    });

  if (signInError || !authData.user) {
    logger.warn('Admin login credential failure', { ip, email: validated.email });
    return NextResponse.json(
      {
        success: false,
        error:   'Invalid credentials.',
        code:    'INVALID_CREDENTIALS',
      },
      { status: 401 }
    );
  }

  // ── 5. Verify admin user type ─────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', authData.user.id)
    .single();

  if (!profile || profile.user_type !== 'admin') {
    await supabase.auth.signOut();
    logger.warn('Non-admin attempted admin login', {
      ip,
      userId: authData.user.id,
    });
    return NextResponse.json(
      {
        success: false,
        error:   'Access denied.',
        code:    'NOT_ADMIN',
      },
      { status: 403 }
    );
  }

  // ── 6. Require verified TOTP factor ───────────────────────────────────────
  const factors    = authData.user.factors ?? [];
  const totpFactor = factors.find(
    (f) => f.factor_type === 'totp' && f.status === 'verified'
  );

  if (!totpFactor) {
    await supabase.auth.signOut();
    logger.error('Admin account has no verified TOTP factor', {
      userId: authData.user.id,
    });
    return NextResponse.json(
      {
        success: false,
        error:   'MFA is mandatory. This account has no verified TOTP factor. Enrol via the secure setup script before logging in.',
        code:    'MFA_NOT_ENROLLED',
      },
      { status: 403 }
    );
  }

  // ── 7. Credentials valid — instruct client to proceed with MFA ────────────
  // The session cookie is now set by the server client above.
  // The browser Supabase client will use it for mfa.challenge() / mfa.verify().
  logger.info('Admin credentials accepted, MFA required', {
    userId: authData.user.id,
    ip,
  });

  return NextResponse.json({
    success:     true,
    requiresMfa: true,
    factorId:    totpFactor.id,
  });
}

// ─── Email alert helper ───────────────────────────────────────────────────────

/**
 * Send a one-time breach alert for this IP within the current rate-limit window.
 * Uses a Redis flag to ensure the admin inbox isn't flooded if an attacker
 * keeps hammering after being blocked.
 *
 * Non-throwing — all errors are logged and swallowed so a nodemailer failure
 * never changes the HTTP response the caller receives.
 */
async function sendBlockAlertIfNeeded(ip: string): Promise<void> {
  try {
    const key            = notifKey(ip);
    const alreadyAlerted = await redis.get(key);
    if (alreadyAlerted) return;

    // Mark as alerted with a 15-minute TTL (matches the rate-limit window)
    await redis.set(key, '1', { ex: 15 * 60 });

    const timestamp  = new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
    const emailBody  = `
SECURITY ALERT — F9 Admin Login Blocked
========================================

The F9 admin login endpoint has been rate-limited for the following IP address:

  IP Address : ${ip}
  Time       : ${timestamp} (WAT)
  Threshold  : 3 attempts per 15 minutes

Access from this IP is blocked for the next 15 minutes.

If this was not you, no immediate action is required — the IP is already blocked.
If you are locked out, wait 15 minutes and retry, or contact your infrastructure provider to whitelist your IP.

— F9 Automated Security System
    `.trim();

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER        ?? ADMIN_ALERT_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from:    `"F9 Security" <${process.env.GMAIL_USER ?? ADMIN_ALERT_EMAIL}>`,
      to:      ADMIN_ALERT_EMAIL,
      subject: `[F9 SECURITY] Admin Login Blocked — IP ${ip}`,
      text:    emailBody,
    });

    logger.warn('Admin login breach alert sent', { ip });
  } catch (err) {
    // Non-fatal — log and continue. A mailer failure must not alter the 429 response.
    logger.error('Failed to send admin login breach alert email', err as Error, { ip });
  }
}