// src/app/f9-control/config/page.tsx
//
// FIX: Page had no authentication check. Added the same auth + requireStaffRole
//   gate used across analytics, finance, flags, and emergency pages.
//
// NOTE: platform_config has an admin ALL policy (user_type='admin'), so the
//   createClient() calls in the server actions continue to work correctly for
//   authenticated admin sessions. No client swap needed in the actions.

import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaffRole }  from '@/lib/auth/require-staff-role';
import { revalidatePath }    from 'next/cache';
import { ConfigClient }      from './Configclient';
import type { Tables }       from '@/types';

export type PlatformConfig = Tables<'platform_config'>;

const CONFIG_ROLES = ['admin'];

// ─── Server Actions ───────────────────────────────────────────────────────────

async function toggleConfig(key: string, enabled: boolean) {
  'use server';
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  // platform_config has admin ALL policy — session client is sufficient for
  // an authenticated admin. No adminClient swap needed.
  await supabase
    .from('platform_config')
    .update({ enabled })
    .eq('key', key);

  revalidatePath('/f9-control/config');
}

async function updateConfigValue(
  key: string,
  value: number | null,
  stringValue: string | null
) {
  'use server';
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  await supabase
    .from('platform_config')
    .update({ value, string_value: stringValue })
    .eq('key', key);

  revalidatePath('/f9-control/config');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminConfigPage() {
  // FIX: Added auth guard — was completely missing before.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, user.id, CONFIG_ROLES);

  const { data: configs } = await supabase
    .from('platform_config')
    .select('*')
    .order('key');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Configuration</h1>
        <p className="text-gray-500 mt-1">
          Changes here apply immediately platform-wide without redeployment.
        </p>
      </div>

      <ConfigClient
        configs={configs ?? []}
        onToggle={toggleConfig}
        onUpdateValue={updateConfigValue}
      />
    </div>
  );
}