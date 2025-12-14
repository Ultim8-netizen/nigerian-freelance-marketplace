// src/lib/api/enhanced-middleware.ts
// Production-ready API middleware combining auth, rate limiting, and validation

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
// FIX: Changed import path to the unified 'middleware' file
import { applyRateLimit, RateLimiterType } from './middleware';
import type { User } from '@supabase/supabase-js';

// Define specific type for profile data returned by requireRole
interface ProfileData {
  user_type: 'freelancer' | 'client' | 'both';
  account_status: 'active' | 'suspended' | 'banned';
}

/**
 * Middleware pipeline result
 */
interface MiddlewareResult {
  user?: User;
  profile?: ProfileData; 
  error?: NextResponse;
}

/**
 * ========================================================================
 * CORE AUTHENTICATION GUARDS
 * ========================================================================
 */

/**
 * Require authentication - User must be logged in
 */
export async function requireAuth(
  request: NextRequest
): Promise<MiddlewareResult> {
  // FIX: Added await
  const supabase = await createClient(); 
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return {
      error: NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized. Please login.',
          code: 'AUTH_REQUIRED' 
        },
        { status: 401 }
      )
    };
  }
  
  // Attach user ID to request headers for downstream use
  request.headers.set('x-user-id', user.id);
  
  return { user };
}

/**
 * Require specific user role
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: Array<'freelancer' | 'client' | 'both'>
): Promise<MiddlewareResult> {
  const authResult = await requireAuth(request);
  if (authResult.error) return authResult;
  
  const { user } = authResult;
  // FIX: Added await
  const supabase = await createClient(); 
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_type, account_status')
    .eq('id', user!.id)
    .single();
  
  if (error || !profile) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Profile not found', code: 'PROFILE_NOT_FOUND' },
        { status: 404 }
      )
    };
  }
  
  // Explicitly cast profile to the defined interface for safety
  const typedProfile = profile as ProfileData;

  // Check account status
  if (typedProfile.account_status !== 'active') {
    return {
      error: NextResponse.json(
        { 
          success: false, 
          error: 'Account is suspended or banned',
          code: 'ACCOUNT_SUSPENDED'
        },
        { status: 403 }
      )
    };
  }
  
  // Check role
  if (!allowedRoles.includes(typedProfile.user_type)) {
    return {
      error: NextResponse.json(
        { 
          success: false, 
          error: `This action requires ${allowedRoles.join(' or ')} role`,
          code: 'INSUFFICIENT_PERMISSIONS'
        },
        { status: 403 }
      )
    };
  }
  
  return { user, profile: typedProfile };
}

/**
 * Require resource ownership
 */
export async function requireOwnership(
  request: NextRequest,
  resourceTable: string,
  resourceId: string,
  ownerField: string = 'user_id'
): Promise<MiddlewareResult> {
  const authResult = await requireAuth(request);
  if (authResult.error) return authResult;
  
  const { user } = authResult;
  // FIX: Added await
  const supabase = await createClient(); 
  
  const { data, error } = await supabase
    .from(resourceTable)
    .select(ownerField)
    .eq('id', resourceId)
    .single();
  
  if (error || !data) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Resource not found', code: 'RESOURCE_NOT_FOUND' },
        { status: 404 }
      )
    };
  }
  
  // FIX: Using a two-step cast (via unknown) to satisfy strict type checking 
  // for dynamic access on a type inferred from Supabase that may not explicitly 
  // contain a string index signature, resolving TS2352.
  if (((data as unknown) as Record<string, string>)[ownerField] !== user!.id) {
    return {
      error: NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden. You do not own this resource.',
          code: 'NOT_RESOURCE_OWNER'
        },
        { status: 403 }
      )
    };
  }
  
  return { user };
}

/**
 * ========================================================================
 * COMBINED MIDDLEWARE PIPELINE
 * ========================================================================
 */

export interface MiddlewareOptions {
  auth?: 'required' | 'optional';
  roles?: Array<'freelancer' | 'client' | 'both'>;
  rateLimit?: RateLimiterType;
  ownership?: {
    table: string;
    idParam: string; // e.g., 'orderId' from URL params
    field?: string;
  };
}

/**
 * Master middleware pipeline
 * Combines auth, rate limiting, role checks, and ownership validation
 */
export async function applyMiddleware(
  request: NextRequest,
  options: MiddlewareOptions = {}
): Promise<MiddlewareResult> {
  const { auth, roles, rateLimit, ownership } = options;

  // 1. Rate Limiting (check first - fastest operation)
  if (rateLimit) {
    const rateLimitResponse = await applyRateLimit(rateLimit, request);
    if (rateLimitResponse) {
      return { error: rateLimitResponse };
    }
  }

  // 2. Authentication
  let result: MiddlewareResult = {};
  
  if (auth === 'required') {
    result = await requireAuth(request);
    if (result.error) return result;
  } else if (auth === 'optional') {
    // FIX: Added await
    const supabase = await createClient(); 
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      result.user = user;
      request.headers.set('x-user-id', user.id);
    }
  }

  // 3. Role Check
  if (roles && roles.length > 0) {
    result = await requireRole(request, roles);
    if (result.error) return result;
  }

  // 4. Ownership Check
  if (ownership && result.user) {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const resourceId = pathSegments[pathSegments.length - 1]; // Simplistic extraction
    
    const ownershipResult = await requireOwnership(
      request,
      ownership.table,
      resourceId,
      ownership.field
    );
    
    if (ownershipResult.error) return ownershipResult;
    
    // Ensure user data is maintained after ownership check
    if (ownershipResult.user) {
      result.user = ownershipResult.user;
    }
  }

  return result;
}

/**
 * ========================================================================
 * SPECIALIZED MIDDLEWARE PRESETS
 * ========================================================================
 */

/**
 * Preset: Freelancer-only endpoints
 */
export async function freelancerOnly(request: NextRequest) {
  return applyMiddleware(request, {
    auth: 'required',
    roles: ['freelancer', 'both'],
  });
}

/**
 * Preset: Client-only endpoints
 */
export async function clientOnly(request: NextRequest) {
  return applyMiddleware(request, {
    auth: 'required',
    roles: ['client', 'both'],
  });
}

/**
 * Preset: Service creation
 */
export async function serviceCreation(request: NextRequest) {
  return applyMiddleware(request, {
    auth: 'required',
    roles: ['freelancer', 'both'],
    rateLimit: 'createService',
  });
}

/**
 * Preset: Job creation
 */
export async function jobCreation(request: NextRequest) {
  return applyMiddleware(request, {
    auth: 'required',
    roles: ['client', 'both'],
    rateLimit: 'createJob',
  });
}

/**
 * Preset: Payment initiation
 */
export async function paymentInitiation(request: NextRequest) {
  return applyMiddleware(request, {
    auth: 'required',
    rateLimit: 'initiatePayment',
  });
}

/**
 * Preset: File upload
 */
export async function fileUpload(request: NextRequest) {
  return applyMiddleware(request, {
    auth: 'required',
    rateLimit: 'fileUpload',
  });
}