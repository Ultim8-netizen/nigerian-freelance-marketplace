// src/app/api/auth/create-profile/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/create-profile
 * * Automatically creates a profile for newly authenticated users.
 */
export async function POST(_req: NextRequest) { // Prefixed with _ to resolve unused-vars
  try {
    const supabase = await createClient();
    
    // Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - No authenticated user' },
        { status: 401 }
      );
    }

    // Check if profile already exists
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
      return NextResponse.json({
        success: true,
        message: 'Profile already exists',
        profileId: existingProfile.id,
      });
    }

    // Create new profile
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || '',
        profile_image_url: user.user_metadata?.avatar_url || null,
        user_type: 'client',
        onboarding_completed: false,
        account_status: 'active',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Profile creation error:', createError);
      return NextResponse.json(
        { error: 'Failed to create profile' },
        { status: 500 }
      );
    }

    // Create a wallet record (Handled with try/catch to avoid .catch type errors)
    try {
      await supabase
        .from('wallets')
        .insert({
          user_id: user.id,
          balance: 0,
          pending_clearance: 0,
          total_earned: 0,
          created_at: new Date().toISOString(),
        });
    } catch (err: unknown) {
      // Non-critical - wallet might already exist or trigger RLS
      console.warn('Wallet creation warning:', err);
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
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}