// src/app/f9-control/emergency/page.tsx
//
// FIX: Page had no authentication check at all. The most sensitive page in
//   the entire admin panel (can enable maintenance mode, pause all withdrawals,
//   kill the marketplace) was reachable by any request that could navigate to
//   it. While the AdminSessionGuard wraps the layout and the middleware
//   checks for the f9_admin_activity cookie, neither is a substitute for an
//   explicit data-layer auth check in the page itself — that's defence in
//   depth, and it's the pattern every other privileged page in this domain
//   follows (analytics, finance, flags). Added the same auth + requireStaffRole
//   gate used on those pages.
//
// NOTE: platform_config has an admin ALL policy (user_type='admin'), so the
//   existing createClient() calls in the server actions continue to work
//   correctly for authenticated admin sessions. No client swap needed there.

import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaffRole }  from '@/lib/auth/require-staff-role';
import { revalidatePath }    from 'next/cache';
import { EmergencyClient }   from './EmergencyClient';

// ─── Emergency control keys ────────────────────────────────────────────────────

const EMERGENCY_KEYS = [
  'maintenance_mode',
  'withdrawals_paused',
  'registrations_enabled',
  'marketplace_enabled',
  'new_orders_enabled',
  'new_proposals_enabled',
] as const;

type EmergencyKey = (typeof EMERGENCY_KEYS)[number];

const EMERGENCY_ROLES = ['admin'];

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

  // platform_config has admin ALL policy — createClient() is sufficient
  // for an authenticated admin session (verified above).
  await supabase
    .from('platform_config')
    .upsert(
      {
        key,
        enabled:      newEnabled,
        description:  controlMeta[key]?.description ?? key,
        value:        null,
        string_value: key === 'maintenance_mode'
          ? ((fd.get('maintenance_message') as string | null)?.trim() || null)
          : null,
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
    invertLogic: true,
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EmergencyControlsPage() {
  // FIX: Added auth guard — was completely missing before.
  // createClient() is used only to confirm the session and identify the user.
  // All data reads below use the same session client since platform_config
  // has an admin ALL policy that covers authenticated admin reads.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const adminClient = createAdminClient();
  await requireStaffRole(adminClient, user.id, EMERGENCY_ROLES);

  const { data: configs } = await supabase
    .from('platform_config')
    .select('key, enabled, string_value')
    .in('key', [...EMERGENCY_KEYS]);

  const configMap: Record<string, { enabled: boolean; string_value: string | null }> = {};
  configs?.forEach((c) => {
    configMap[c.key] = {
      enabled:      c.enabled ?? false,
      string_value: c.string_value ?? null,
    };
  });

  const controls = EMERGENCY_KEYS.map((key) => ({
    key,
    enabled: configMap[key]?.enabled ?? false,
    ...controlMeta[key],
  }));

  const currentMaintenanceMsg: string =
    configMap['maintenance_mode']?.string_value ?? '';

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
        currentMaintenanceMsg={currentMaintenanceMsg}
        onToggle={toggleEmergencyControl}
      />
    </div>
  );
}