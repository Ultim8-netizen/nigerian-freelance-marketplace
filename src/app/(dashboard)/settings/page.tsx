// src/app/(dashboard)/settings/page.tsx
// Account settings — lives at /settings inside the (dashboard) route group.
// Server component: handles auth guard, then renders the interactive client component.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SettingsPage from '@/components/settings/SettingsPage';

export const metadata = {
  title: 'Settings',
};

export default async function SettingsRoute() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <SettingsPage />;
}