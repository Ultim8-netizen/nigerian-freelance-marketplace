// src/lib/api/enhanced-middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { applyRateLimit, RateLimiterType } from './middleware';
import { z } from 'zod';
import type { User, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const ProfileSchema = z.object({
  user_type:      z.enum(['freelancer', 'client', 'both']),
  account_status: z.enum(['active', 'suspended', 'banned']),
});

const createOwnershipSchema = (ownerField: string) =>
  z.record(z.string(), z.unknown()).refine(
    (data) => ownerField in data,
    { message: `Missing ownership field: ${ownerField}` }
  );

const PostingSuspensionSchema = z.object({
  posting_suspended_until: z.string().nullable(),
});

export type ProfileData = z.infer<typeof ProfileSchema>;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface MiddlewareResult {
  user?:    User;
  profile?: ProfileData;
  error?:   NextResponse;
}

interface MiddlewareOptions {
  auth?:      'required' | 'optional';
  roles?:     Array<'freelancer' | 'client' | 'both'>;
  rateLimit?: RateLimiterType;
  ownership?: {
    table:       string;
    field?:      string;
    // Explicit resource ID override. Required for sub-resource routes where
    // the ID cannot be reliably inferred from the URL, e.g.:
    //   /api/services/{uuid}/reviews  → last segment is 'reviews', not a UUID
    //   /api/orders/{uuid}/dispute    → last segment is 'dispute'
    // When provided, bypasses extractResourceId entirely.
    resourceId?: string;
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

const _UUID_RE    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const _NUMERIC_RE = /^\d+$/;

/**
 * Walks path segments right-to-left and returns the first UUID or purely
 * numeric segment. This correctly handles arbitrarily deep sub-resource paths
 * without a hard-coded list of action verb suffixes.
 *
 * Examples:
 *   /api/services/abc-123             → 'abc-123'   (UUID, last segment)
 *   /api/services/abc-123/reviews     → 'abc-123'   (UUID, second-to-last)
 *   /api/orders/42/dispute            → '42'        (numeric, second-to-last)
 */
function extractResourceId(url: string): string | undefined {
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    if (_UUID_RE.test(segments[i]) || _NUMERIC_RE.test(segments[i])) {
      return segments[i];
    }
  }
  return undefined;
}

// ============================================================================
// CORE AUTHENTICATION GUARDS
// ============================================================================

/**
 * Verify the authenticated user via a server-side JWT validation round-trip.
 *
 * NOTE: Does NOT mutate request.headers. NextRequest headers are immutable in
 * the App Router — mutations are silently dropped and never reach downstream
 * handlers. The resolved User is returned via MiddlewareResult; route handlers
 * read user.id from there.
 */
export async function requireAuth(
  request:  NextRequest,
  supabase: SupabaseClient
): Promise<MiddlewareResult> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        error: NextResponse.json(
          { success: false, error: 'Unauthorized. Please login.', code: 'AUTH_REQUIRED' },
          { status: 401 }
        ),
      };
    }

    return { user };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      error: NextResponse.json(
        { success: false, error: 'Authentication failed', code: 'AUTH_ERROR' },
        { status: 500 }
      ),
    };
  }
}

export async function requireRole(
  request:       NextRequest,
  allowedRoles:  Array<'freelancer' | 'client' | 'both'>,
  supabase:      SupabaseClient,
  existingUser?: User
): Promise<MiddlewareResult> {
  let user = existingUser;
  if (!user) {
    const authResult = await requireAuth(request, supabase);
    if (authResult.error) return authResult;
    user = authResult.user;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_type, account_status')
      .eq('id', user!.id)
      .maybeSingle();

    if (error) {
      console.error('Profile fetch error:', error);
      return {
        error: NextResponse.json(
          { success: false, error: 'Failed to verify user profile', code: 'PROFILE_FETCH_ERROR' },
          { status: 500 }
        ),
      };
    }

    if (!data) {
      return {
        error: NextResponse.json(
          { success: false, error: 'Profile not found', code: 'PROFILE_NOT_FOUND' },
          { status: 404 }
        ),
      };
    }

    const validation = ProfileSchema.safeParse(data);
    if (!validation.success) {
      console.error('Profile validation error:', validation.error);
      return {
        error: NextResponse.json(
          { success: false, error: 'Invalid profile data', code: 'SCHEMA_MISMATCH' },
          { status: 500 }
        ),
      };
    }

    const profile = validation.data;

    if (profile.account_status !== 'active') {
      return {
        error: NextResponse.json(
          {
            success: false,
            error:   `Account is ${profile.account_status}`,
            code:    'ACCOUNT_SUSPENDED',
          },
          { status: 403 }
        ),
      };
    }

    if (!allowedRoles.includes(profile.user_type)) {
      return {
        error: NextResponse.json(
          {
            success: false,
            error:   `This action requires ${allowedRoles.join(' or ')} role`,
            code:    'INSUFFICIENT_PERMISSIONS',
          },
          { status: 403 }
        ),
      };
    }

    return { user, profile };
  } catch (error) {
    console.error('Role check error:', error);
    return {
      error: NextResponse.json(
        { success: false, error: 'Role verification failed', code: 'ROLE_CHECK_ERROR' },
        { status: 500 }
      ),
    };
  }
}

export async function requireOwnership(
  request:       NextRequest,
  resourceTable: string,
  resourceId:    string,
  ownerField:    string = 'user_id',
  supabase:      SupabaseClient,
  existingUser?: User
): Promise<MiddlewareResult> {
  let user = existingUser;
  if (!user) {
    const authResult = await requireAuth(request, supabase);
    if (authResult.error) return authResult;
    user = authResult.user;
  }

  try {
    const { data, error } = await supabase
      .from(resourceTable)
      .select(ownerField)
      .eq('id', resourceId)
      .maybeSingle();

    if (error) {
      console.error('Ownership check error:', error);
      return {
        error: NextResponse.json(
          { success: false, error: 'Failed to verify ownership', code: 'OWNERSHIP_CHECK_ERROR' },
          { status: 500 }
        ),
      };
    }

    if (!data) {
      return {
        error: NextResponse.json(
          { success: false, error: 'Resource not found', code: 'RESOURCE_NOT_FOUND' },
          { status: 404 }
        ),
      };
    }

    const ownershipSchema = createOwnershipSchema(ownerField);
    const validation = ownershipSchema.safeParse(data);

    if (!validation.success) {
      console.error('Ownership validation error:', validation.error);
      return {
        error: NextResponse.json(
          { success: false, error: 'Resource ownership format invalid', code: 'SCHEMA_MISMATCH' },
          { status: 500 }
        ),
      };
    }

    const resourceData = validation.data as Record<string, unknown>;
    if (resourceData[ownerField] !== user!.id) {
      return {
        error: NextResponse.json(
          {
            success: false,
            error:   'Forbidden. You do not own this resource.',
            code:    'NOT_RESOURCE_OWNER',
          },
          { status: 403 }
        ),
      };
    }

    return { user };
  } catch (error) {
    console.error('Ownership verification error:', error);
    return {
      error: NextResponse.json(
        { success: false, error: 'Ownership verification failed', code: 'OWNERSHIP_ERROR' },
        { status: 500 }
      ),
    };
  }
}

// ============================================================================
// POSTING SUSPENSION GUARD
// ============================================================================

export async function requirePostingActive(
  userId:   string,
  supabase: SupabaseClient
): Promise<NextResponse | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('posting_suspended_until')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Posting suspension check error:', error);
      return null; // Fail open — unexpected DB error should not block a legit user
    }

    const validation = PostingSuspensionSchema.safeParse(data);
    if (!validation.success) {
      console.error('Posting suspension schema mismatch:', validation.error);
      return null;
    }

    const { posting_suspended_until } = validation.data;

    if (posting_suspended_until !== null && new Date(posting_suspended_until) > new Date()) {
      return NextResponse.json(
        {
          success:   false,
          error:
            'Your posting privileges are temporarily suspended due to multiple ' +
            '1-star reviews. You cannot create new listings at this time.',
          code:      'POSTING_SUSPENDED',
          resumesAt: new Date(posting_suspended_until).toISOString(),
        },
        { status: 403 }
      );
    }

    return null;
  } catch (err) {
    console.error('Unexpected error in requirePostingActive:', err);
    return null;
  }
}

// ============================================================================
// MASTER MIDDLEWARE PIPELINE
// ============================================================================

/**
 * Orchestrates auth, rate limiting, role, and ownership checks in a single
 * call with one shared Supabase client.
 *
 * Pipeline order for `auth: 'required'` routes:
 *   1. Auth (getUser — resolves userId)
 *   2. Rate limit by userId (not IP)
 *   3. Role check
 *   4. Ownership check
 *
 * FIX: Rate limiting previously ran before auth, so the identifier was always
 * the request IP. Under Nigerian mobile carrier NAT and university campus
 * networks a single IP can represent hundreds of users — one user's quota
 * would exhaust the limit for all others sharing that IP. By running auth
 * first on auth-required routes we can rate limit per user ID, which is the
 * correct model for marketplace operations (createService, createJob, etc.).
 *
 * Pipeline order for `auth: 'optional'` or no auth:
 *   1. Rate limit by IP (no userId available yet)
 *   2. Optional auth resolution
 *
 * Note: posting suspension is NOT wired into this pipeline because it applies
 * only to specific POST actions. Call requirePostingActive() directly in those
 * handlers after auth resolves.
 */
export async function applyMiddleware(
  request: NextRequest,
  options: MiddlewareOptions = {}
): Promise<MiddlewareResult> {
  const { auth, roles, rateLimit, ownership } = options;

  const supabase = await createClient();
  let result: MiddlewareResult = {};

  if (auth === 'required') {
    // Step 1: Resolve the authenticated user first.
    result = await requireAuth(request, supabase);
    if (result.error) return result;

    // Step 2: Rate limit by userId — correct for per-user quota enforcement.
    if (rateLimit) {
      const rateLimitResponse = await applyRateLimit(rateLimit, request, result.user!.id);
      if (rateLimitResponse) return { error: rateLimitResponse };
    }
  } else {
    // No required auth: rate limit by IP before touching the DB.
    if (rateLimit) {
      const rateLimitResponse = await applyRateLimit(rateLimit, request);
      if (rateLimitResponse) return { error: rateLimitResponse };
    }

    if (auth === 'optional') {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) result.user = user;
      } catch (error) {
        console.error('Optional auth check error:', error);
      }
    }
  }

  // Step 3: Role check (reuses existing user and client — no extra getUser call).
  if (roles && roles.length > 0 && result.user) {
    const roleResult = await requireRole(request, roles, supabase, result.user);
    if (roleResult.error) return roleResult;
    if (roleResult.profile) result.profile = roleResult.profile;
  }

  // Step 4: Ownership check.
  if (ownership && result.user) {
    // Explicit resourceId takes priority; fall back to URL inference only for
    // simple /api/table/{id} paths where the ID is the last path segment.
    const resourceId = ownership.resourceId ?? extractResourceId(request.url);

    if (!resourceId) {
      return {
        error: NextResponse.json(
          { success: false, error: 'Resource ID not found in URL', code: 'INVALID_RESOURCE_ID' },
          { status: 400 }
        ),
      };
    }

    const ownershipResult = await requireOwnership(
      request,
      ownership.table,
      resourceId,
      ownership.field,
      supabase,
      result.user
    );

    if (ownershipResult.error) return ownershipResult;
  }

  return result;
}

// ============================================================================
// SPECIALIZED MIDDLEWARE PRESETS
// ============================================================================

export const freelancerOnly = (req: NextRequest) =>
  applyMiddleware(req, { auth: 'required', roles: ['freelancer', 'both'] });

export const clientOnly = (req: NextRequest) =>
  applyMiddleware(req, { auth: 'required', roles: ['client', 'both'] });

export const serviceCreation = (req: NextRequest) =>
  applyMiddleware(req, { auth: 'required', roles: ['freelancer', 'both'], rateLimit: 'createService' });

export const jobCreation = (req: NextRequest) =>
  applyMiddleware(req, { auth: 'required', roles: ['client', 'both'], rateLimit: 'createJob' });

export const paymentInitiation = (req: NextRequest) =>
  applyMiddleware(req, { auth: 'required', rateLimit: 'initiatePayment' });

export const fileUpload = (req: NextRequest) =>
  applyMiddleware(req, { auth: 'required', rateLimit: 'fileUpload' });

export const authenticatedApi = (req: NextRequest) =>
  applyMiddleware(req, { auth: 'required', rateLimit: 'api' });

export const publicApi = (req: NextRequest) =>
  applyMiddleware(req, { auth: 'optional', rateLimit: 'api' });