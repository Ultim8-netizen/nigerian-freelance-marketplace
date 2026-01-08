// src/app/api/profile/complete-onboarding/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    console.error('Onboarding completion error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
} 