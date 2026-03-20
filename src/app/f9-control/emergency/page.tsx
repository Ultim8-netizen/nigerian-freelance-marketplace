import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { EmergencyClient } from './EmergencyClient';

// ─── Emergency control keys — all map to platform_config.key ─────────────────
//
// Each key is upserted: if the row doesn't exist yet it's created.
// middleware.ts should read `maintenance_mode` to block user access.

const EMERGENCY_KEYS = [
  'maintenance_mode',
  'withdrawals_paused',
  'registrations_enabled',
  'marketplace_enabled',
  'new_orders_enabled',
  'new_proposals_enabled',
] as const;

type EmergencyKey = (typeof EMERGENCY_KEYS)[number];

// ─── Server Actions ───────────────────────────────────────────────────────────

async function toggleEmergencyControl(fd: FormData) {
  'use server';
  const key        = fd.get('key')     as EmergencyKey;
  const newEnabled = fd.get('enabled') === 'true';
  const reason     = (fd.get('reason') as string | null) || null;

  if (!EMERGENCY_KEYS.includes(key)) throw new Error('Invalid key');

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  await supabase
    .from('platform_config')
    .upsert(
      {
        key,
        enabled:      newEnabled,
        description:  controlMeta[key]?.description ?? key,
        value:        null,
        string_value: null,
      },
      { onConflict: 'key' }
    );

  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: null,
    action_type:    'emergency_toggle',
    reason:         `[${key}] set to ${newEnabled} ${reason ? `— ${reason}` : ''}`.trim(),
  });

  revalidatePath('/f9-control/emergency');
  revalidatePath('/f9-control');
}

// ─── Control metadata ─────────────────────────────────────────────────────────

const controlMeta: Record<
  EmergencyKey,
  { label: string; description: string; danger: boolean; invertLogic?: boolean }
> = {
  maintenance_mode: {
    label:       'Maintenance Mode',
    description: 'When ON, all user-facing routes are blocked and a maintenance page is shown. Middleware must read this key.',
    danger:      true,
  },
  withdrawals_paused: {
    label:       'Pause All Withdrawals',
    description: 'When ON, withdrawal processing is suspended platform-wide. Existing requests are queued.',
    danger:      true,
  },
  registrations_enabled: {
    label:       'User Registrations',
    description: 'When OFF, new account creation is disabled. Existing users are unaffected.',
    danger:      false,
    invertLogic: true, // "enabled = false" is the dangerous state here
  },
  marketplace_enabled: {
    label:       'Marketplace',
    description: 'When OFF, the product marketplace is hidden and orders cannot be placed.',
    danger:      false,
    invertLogic: true,
  },
  new_orders_enabled: {
    label:       'New Service Orders',
    description: 'When OFF, clients cannot place new freelance orders. Active orders are unaffected.',
    danger:      false,
    invertLogic: true,
  },
  new_proposals_enabled: {
    label:       'New Job Proposals',
    description: 'When OFF, freelancers cannot submit proposals on open jobs.',
    danger:      false,
    invertLogic: true,
  },
};

// ─── Data fetch ───────────────────────────────────────────────────────────────

export default async function EmergencyControlsPage() {
  const supabase = await createClient();

  const { data: configs } = await supabase
    .from('platform_config')
    .select('key, enabled')
    .in('key', [...EMERGENCY_KEYS]);

  // Build a key→enabled lookup, defaulting missing keys to their safe state
  const configMap: Record<string, boolean> = {};
  configs?.forEach((c) => {
    configMap[c.key] = c.enabled ?? false;
  });

  // Build the controls array in the defined order
  const controls = EMERGENCY_KEYS.map((key) => ({
    key,
    enabled: configMap[key] ?? false,
    ...controlMeta[key],
  }));

  // Recent emergency audit trail
  const { data: recentActions } = await supabase
    .from('admin_action_logs')
    .select('id, action_type, reason, created_at, admin_id')
    .eq('action_type', 'emergency_toggle')
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Emergency Controls</h1>
        <p className="text-sm text-red-600 font-medium mt-1">
          ⚠ These controls affect all users immediately. Every action is logged.
        </p>
      </div>

      <EmergencyClient
        controls={controls}
        recentActions={recentActions ?? []}
        onToggle={toggleEmergencyControl}
      />
    </div>
  );
}