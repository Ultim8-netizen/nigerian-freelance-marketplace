import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ConfigClient } from './Configclient';
import type { Tables } from '@/types';

export type PlatformConfig = Tables<'platform_config'>;

// ─── Server Actions ───────────────────────────────────────────────────────────

async function toggleConfig(key: string, enabled: boolean) {
  'use server';
  const supabase = await createClient();
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
  await supabase
    .from('platform_config')
    .update({ value, string_value: stringValue })
    .eq('key', key);
  revalidatePath('/f9-control/config');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminConfigPage() {
  const supabase = await createClient();
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