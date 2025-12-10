// src/lib/api/middleware.ts
// API authentication and authorization middleware

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

interface AuthResult {
  user: User;
  response?: NextResponse;
}

/**
 * Verify user is authenticated
 * Use this in every protected API route
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthResult | NextResponse> {
  const supabase = createClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized. Please login.' },
      { status: 401 }
    );
  }
  
  return { user };
}

/**
 * Verify user owns a resource
 */
export async function requireOwnership(
  request: NextRequest,
  resourceTable: string,
  resourceId: string,
  ownerField: string = 'user_id'
): Promise<AuthResult | NextResponse> {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { user } = authResult;
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from(resourceTable)
    .select(ownerField)
    .eq('id', resourceId)
    .single();
  
  if (error || !data) {
    return NextResponse.json(
      { success: false, error: 'Resource not found' },
      { status: 404 }
    );
  }
  
  if (data[ownerField] !== user.id) {
    return NextResponse.json(
      { success: false, error: 'Forbidden. You do not own this resource.' },
      { status: 403 }
    );
  }
  
  return { user };
}

/**
 * Verify user has specific role
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: Array<'freelancer' | 'client' | 'both'>
): Promise<AuthResult | NextResponse> {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { user } = authResult;
  const supabase = createClient();
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_type, account_status')
    .eq('id', user.id)
    .single();
  
  if (error || !profile) {
    return NextResponse.json(
      { success: false, error: 'Profile not found' },
      { status: 404 }
    );
  }
  
  if (profile.account_status !== 'active') {
    return NextResponse.json(
      { success: false, error: 'Account is suspended or banned' },
      { status: 403 }
    );
  }
  
  if (!allowedRoles.includes(profile.user_type)) {
    return NextResponse.json(
      { 
        success: false, 
        error: `This action requires ${allowedRoles.join(' or ')} role` 
      },
      { status: 403 }
    );
  }
  
  return { user };
}

/**
 * Usage example in API route:
 * 
 * export async function POST(request: NextRequest) {
 *   const authResult = await requireAuth(request);
 *   if (authResult instanceof NextResponse) return authResult;
 *   
 *   const { user } = authResult;
 *   // ... rest of your logic
 * }
 */