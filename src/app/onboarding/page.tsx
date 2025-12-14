// src/app/onboarding/page.tsx
import { LocationSetupStep } from '@/components/onboarding/LocationSetup';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if already completed
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, location')
    .eq('id', user.id)
    .single();

  if (profile?.onboarding_completed) {
    redirect('/dashboard');
  }

  return <LocationSetupStep />;
}