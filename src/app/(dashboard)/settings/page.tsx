// src/app/(dashboard)/freelancer/reviews/page.tsx
// FIXED: Settings page route alias - was returning 404 when clicked from sidebar

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function SettingsPageRedirect() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Redirect to the dashboard settings page
  // This handles the /settings route alias
  redirect('/dashboard/settings');
}