// src/lib/api/enhanced-middleware.ts
// PRODUCTION-READY: Merged implementation with Zod validation + performance optimizations

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { applyRateLimit, RateLimiterType } from './middleware';
import { z } from 'zod';
import type { User, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// VALIDATION SCHEMAS (Zod)
// ============================================================================

const ProfileSchema = z.object({
  user_type: z.enum(['freelancer', 'client', 'both']),
  account_status: z.enum(['active', 'suspended', 'banned']),
});

/**
 * Dynamic schema for ownership validation
 * Solves TypeScript TS2352 without unsafe casting
 * FIX: Explicitly provided Key (z.string()) and Value (z.unknown()) schemas
 */
const createOwnershipSchema = (ownerField: string) =>
  z.record(z.string(), z.unknown()).refine(
    (data) => ownerField in data,
    { message: `Missing ownership field: ${ownerField}` }
  );

export type ProfileData = z.infer<typeof ProfileSchema>;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface MiddlewareResult {
  user?: User;
  profile?: ProfileData;
  error?: NextResponse;
}

interface MiddlewareOptions {
  auth?: 'required' | 'optional';
  roles?: Array<'freelancer' | 'client' | 'both'>;
  rateLimit?: RateLimiterType;
  ownership?: {
    table: string;
    field?: string;
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Robustly extracts a Resource ID from the URL.
 * Ignores common trailing action verbs like 'edit', 'delete', etc.
 */
function extractResourceId(url: string): string | undefined {
  const pathSegments = new URL(url).pathname.split('/').filter(Boolean);
  
  if (pathSegments.length === 0) return undefined;

  const lastSegment = pathSegments[pathSegments.length - 1];
  
  // List of common action suffixes to ignore when guessing ID
  const ACTION_VERBS = ['edit', 'delete', 'update', 'status', 'upload'];
  
  if (ACTION_VERBS.includes(lastSegment) && pathSegments.length > 1) {
    return pathSegments[pathSegments.length - 2];
  }

  return lastSegment;
}

// ============================================================================
// CORE AUTHENTICATION GUARDS
// ============================================================================

/**
 * Require authentication
 * - Uses shared Supabase client to avoid re-initialization
 */
export async function requireAuth(
  request: NextRequest,
  supabase: SupabaseClient
): Promise<MiddlewareResult> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        error: NextResponse.json(
          {
            success: false,
            error: 'Unauthorized. Please login.',
            code: 'AUTH_REQUIRED',
          },
          { status: 401 }
        ),
      };
    }

    // Mutate headers for downstream use
    request.headers.set('x-user-id', user.id);
    request.headers.set('x-user-email', user.email || '');

    return { user };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      error: NextResponse.json(
        {
          success: false,
          error: 'Authentication failed',
          code: 'AUTH_ERROR',
        },
        { status: 500 }
      ),
    };
  }
}

/**
 * Require specific user role + Profile validation
 * - Accepts existing user/client to prevent redundant DB calls
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: Array<'freelancer' | 'client' | 'both'>,
  supabase: SupabaseClient,
  existingUser?: User
): Promise<MiddlewareResult> {
  
  // 1. Resolve User (Use existing or fetch new)
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
          {
            success: false,
            error: 'Failed to verify user profile',
            code: 'PROFILE_FETCH_ERROR',
          },
          { status: 500 }
        ),
      };
    }

    if (!data) {
      return {
        error: NextResponse.json(
          {
            success: false,
            error: 'Profile not found',
            code: 'PROFILE_NOT_FOUND',
          },
          { status: 404 }
        ),
      };
    }

    // Validate profile data shape
    const validation = ProfileSchema.safeParse(data);
    if (!validation.success) {
      console.error('Profile validation error:', validation.error);
      return {
        error: NextResponse.json(
          {
            success: false,
            error: 'Invalid profile data',
            code: 'SCHEMA_MISMATCH',
          },
          { status: 500 }
        ),
      };
    }

    const profile = validation.data;

    // Check account status
    if (profile.account_status !== 'active') {
      return {
        error: NextResponse.json(
          {
            success: false,
            error: `Account is ${profile.account_status}`,
            code: 'ACCOUNT_SUSPENDED',
          },
          { status: 403 }
        ),
      };
    }

    // Check role
    if (!allowedRoles.includes(profile.user_type)) {
      return {
        error: NextResponse.json(
          {
            success: false,
            error: `This action requires ${allowedRoles.join(' or ')} role`,
            code: 'INSUFFICIENT_PERMISSIONS',
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
        {
          success: false,
          error: 'Role verification failed',
          code: 'ROLE_CHECK_ERROR',
        },
        { status: 500 }
      ),
    };
  }
}

/**
 * Require resource ownership
 * - Accepts existing user/client for performance
 */
export async function requireOwnership(
  request: NextRequest,
  resourceTable: string,
  resourceId: string,
  ownerField: string = 'user_id',
  supabase: SupabaseClient,
  existingUser?: User
): Promise<MiddlewareResult> {
  
  // 1. Resolve User
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
          {
            success: false,
            error: 'Failed to verify ownership',
            code: 'OWNERSHIP_CHECK_ERROR',
          },
          { status: 500 }
        ),
      };
    }

    if (!data) {
      return {
        error: NextResponse.json(
          {
            success: false,
            error: 'Resource not found',
            code: 'RESOURCE_NOT_FOUND',
          },
          { status: 404 }
        ),
      };
    }

    // Validate ownership field exists using Zod
    const ownershipSchema = createOwnershipSchema(ownerField);
    const validation = ownershipSchema.safeParse(data);

    if (!validation.success) {
      console.error('Ownership validation error:', validation.error);
      return {
        error: NextResponse.json(
          {
            success: false,
            error: 'Resource ownership format invalid',
            code: 'SCHEMA_MISMATCH',
          },
          { status: 500 }
        ),
      };
    }

    // Safe property access via validated data
    const resourceData = validation.data as Record<string, unknown>;
    if (resourceData[ownerField] !== user!.id) {
      return {
        error: NextResponse.json(
          {
            success: false,
            error: 'Forbidden. You do not own this resource.',
            code: 'NOT_RESOURCE_OWNER',
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
        {
          success: false,
          error: 'Ownership verification failed',
          code: 'OWNERSHIP_ERROR',
        },
        { status: 500 }
      ),
    };
  }
}

// ============================================================================
// MASTER MIDDLEWARE PIPELINE
// ============================================================================

/**
 * Main middleware orchestrator
 * - Single Supabase client initialization (Performance Fix)
 * - Sequential checks: rate limit → auth → roles → ownership
 */
export async function applyMiddleware(
  request: NextRequest,
  options: MiddlewareOptions = {}
): Promise<MiddlewareResult> {
  const { auth, roles, rateLimit, ownership } = options;

  // 1. RATE LIMITING (Fastest check first - no DB calls)
  if (rateLimit) {
    const rateLimitResponse = await applyRateLimit(rateLimit, request);
    if (rateLimitResponse) {
      return { error: rateLimitResponse };
    }
  }

  // Initialize Supabase Client ONCE for the entire pipeline
  const supabase = await createClient();
  let result: MiddlewareResult = {};

  // 2. AUTHENTICATION
  if (auth === 'required') {
    result = await requireAuth(request, supabase);
    if (result.error) return result;
  } else if (auth === 'optional') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        result.user = user;
        request.headers.set('x-user-id', user.id);
        request.headers.set('x-user-email', user.email || '');
      }
    } catch (error) {
      console.error('Optional auth check error:', error);
    }
  }

  // 3. ROLE CHECK (Reuse existing user & client)
  if (roles && roles.length > 0 && result.user) {
    // Pass the user we already found to avoid re-fetching
    const roleResult = await requireRole(request, roles, supabase, result.user);
    if (roleResult.error) return roleResult;
    // Merge profile data into result
    if (roleResult.profile) result.profile = roleResult.profile;
  }

  // 4. OWNERSHIP CHECK (Reuse existing user & client)
  if (ownership && result.user) {
    const resourceId = extractResourceId(request.url);

    if (!resourceId) {
      return {
        error: NextResponse.json(
          {
            success: false,
            error: 'Resource ID not found in URL',
            code: 'INVALID_RESOURCE_ID',
          },
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
      result.user // Pass existing user
    );

    if (ownershipResult.error) return ownershipResult;
    // Ownership check implicitly re-validates user, but we keep the original context
  }

  return result;
}

// ============================================================================
// SPECIALIZED MIDDLEWARE PRESETS
// ============================================================================

export const freelancerOnly = (req: NextRequest) =>
  applyMiddleware(req, {
    auth: 'required',
    roles: ['freelancer', 'both'],
  });

export const clientOnly = (req: NextRequest) =>
  applyMiddleware(req, {
    auth: 'required',
    roles: ['client', 'both'],
  });

export const serviceCreation = (req: NextRequest) =>
  applyMiddleware(req, {
    auth: 'required',
    roles: ['freelancer', 'both'],
    rateLimit: 'createService',
  });

export const jobCreation = (req: NextRequest) =>
  applyMiddleware(req, {
    auth: 'required',
    roles: ['client', 'both'],
    rateLimit: 'createJob',
  });

export const paymentInitiation = (req: NextRequest) =>
  applyMiddleware(req, {
    auth: 'required',
    rateLimit: 'initiatePayment',
  });

export const fileUpload = (req: NextRequest) =>
  applyMiddleware(req, {
    auth: 'required',
    rateLimit: 'fileUpload',
  });

export const authenticatedApi = (req: NextRequest) =>
  applyMiddleware(req, {
    auth: 'required',
    rateLimit: 'api',
  });

export const publicApi = (req: NextRequest) =>
  applyMiddleware(req, {
    auth: 'optional',
    rateLimit: 'api',
  });