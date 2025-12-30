// src/app/(dashboard)/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardRootRedirect() {
  const supabase = await createClient();
  
  // 1. Get the current user
  // We use getUser() instead of getSession() for security on the server
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // 2. Fetch the user profile to check their role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  // 3. Handle cases where profile might not exist yet
  if (profileError || !profile) {
    redirect('/onboarding');
  }

  // 4. Redirect based on role
  // 'client' -> Client Dashboard
  // 'freelancer' or 'both' -> Freelancer Dashboard
  if (profile.user_type === 'client') {
    redirect('/client/dashboard');
  } 
  
  if (profile.user_type === 'freelancer' || profile.user_type === 'both') {
    redirect('/freelancer/dashboard');
  }

  // Final fallback
  redirect('/onboarding');
}