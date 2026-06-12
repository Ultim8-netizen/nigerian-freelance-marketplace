// src/app/api/auth/create-profile/route.ts
//
// FIXES applied:
//  1. user_type was hardcoded to 'client' — now read from user.user_metadata
//     with validated fallback (matches handle_new_user trigger behaviour).
//  2. Wallet creation switched from user-session supabase to adminClient.
//     wallets has a SELECT-only RLS policy — user session INSERT was
//     silently blocked every time this route ran.
//  3. When profile already exists (trigger path), check whether a wallet
//     also exists. The handle_new_user trigger only creates wallets for
//     'freelancer' | 'both'. Clients and students arrive here with a
//     profile but no wallet; we create one via adminClient.
//  4. Fallback profile creation now includes ALL metadata fields
//     (phone_number, university, location) — the old version omitted them,
//     producing structurally incomplete profiles on the rare trigger-miss.
//  5. Handle unique_violation (23505) gracefully in fallback path —
//     a concurrent request or trigger race is not an error.

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

const VALID_USER_TYPES = ['client', 'freelancer', 'student', 'both'] as const;
type UserType = (typeof VALID_USER_TYPES)[number];

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // ── 1. Auth guard ────────────────────────────────────────────────────────
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - No authenticated user' },
        { status: 401 }
      );
    }

    // ── 2. Resolve user_type from metadata ───────────────────────────────────
    // Validate against allowed values. The DB column default is 'both' but
    // signUp always passes one of the four values via options.data. We fall
    // back to 'client' only as a last resort (safest assumption for a user
    // who somehow has no metadata).
    const rawUserType = user.user_metadata?.user_type as string | undefined;
    const userType: UserType = VALID_USER_TYPES.includes(rawUserType as UserType)
      ? (rawUserType as UserType)
      : 'client';

    // ── 3. Check if profile already exists ──────────────────────────────────
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Failed to check profile existence' },
        { status: 500 }
      );
    }

    if (existingProfile) {
      // Profile exists — but the handle_new_user trigger only creates wallets
      // for user_type IN ('freelancer', 'both'). Clients and students arrive
      // here with no wallet. Fill the gap using adminClient (wallets RLS has
      // no INSERT policy for authenticated users).
      const { data: existingWallet } = await adminClient
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!existingWallet) {
        const { error: walletGapError } = await adminClient.from('wallets').insert({
          user_id: user.id,
          balance: 0,
          pending_clearance: 0,
          total_earned: 0,
          total_withdrawn: 0,
          created_at: new Date().toISOString(),
        });

        if (walletGapError && walletGapError.code !== '23505') {
          // Non-critical — log but do not block the login flow.
          console.warn('Wallet gap-fill warning (existing profile):', walletGapError);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Profile already exists',
        profileId: existingProfile.id,
      });
    }

    // ── 4. Fallback profile creation (trigger miss) ──────────────────────────
    // Mirrors the handle_new_user trigger INSERT exactly, including all
    // metadata fields. The user-session client is correct here because the
    // profiles INSERT policy is: WITH CHECK (auth.uid() = id).
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email ?? '',
        full_name: user.user_metadata?.full_name ?? '',
        phone_number: user.user_metadata?.phone_number ?? null,
        university: user.user_metadata?.university ?? null,
        location: user.user_metadata?.location ?? null,
        profile_image_url: user.user_metadata?.avatar_url ?? null,
        user_type: userType,
        account_status: 'active',
        trust_score: 0,
        trust_level: 'new',
        identity_verified: false,
        student_verified: false,
        liveness_verified: false,
        onboarding_completed: false,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (createError) {
      // 23505 = unique_violation — trigger or concurrent request already created
      // the profile. This is not a real error; return success.
      if (createError.code === '23505') {
        return NextResponse.json({
          success: true,
          message: 'Profile already exists',
        });
      }
      console.error('Profile creation error:', createError);
      return NextResponse.json(
        { error: 'Failed to create profile' },
        { status: 500 }
      );
    }

    // ── 5. Wallet creation via adminClient ───────────────────────────────────
    // wallets has no user INSERT policy — service role required.
    // Create for ALL user types: clients need wallets to fund escrow orders.
    const { error: walletError } = await adminClient.from('wallets').insert({
      user_id: user.id,
      balance: 0,
      pending_clearance: 0,
      total_earned: 0,
      total_withdrawn: 0,
      created_at: new Date().toISOString(),
    });

    if (walletError && walletError.code !== '23505') {
      // Log but do not fail — wallet can be lazily re-created on next login.
      console.warn('Wallet creation warning in fallback path:', walletError);
    }

    return NextResponse.json({
      success: true,
      message: 'Profile created successfully',
      profileId: newProfile.id,
    });
  } catch (error: unknown) {
    console.error('Profile creation endpoint error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}