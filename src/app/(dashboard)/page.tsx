// src/app/(dashboard)/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardRootRedirect() {
  const supabase = await createClient();
  
  // 1. Get the current user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 2. Fetch the user profile to check their role
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  // 3. Redirect based on role
  // If 'client' -> go to Client Dashboard
  // If 'freelancer' or 'both' -> go to Freelancer Dashboard (default view)
  if (profile?.user_type === 'client') {
    redirect('/client/dashboard');
  } else if (profile?.user_type === 'freelancer' || profile?.user_type === 'both') {
    redirect('/freelancer/dashboard');
  } else {
    // Fallback if something is wrong with the profile
    redirect('/onboarding');
  }
}