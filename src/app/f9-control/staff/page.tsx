import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { StaffClient } from './StaffClient';

// ─── Constants ────────────────────────────────────────────────────────────────

export const ROLE_TYPES = ['moderator', 'financial_analyst', 'community_manager'] as const;
export type RoleType = (typeof ROLE_TYPES)[number];

export const DEFAULT_CAPS: Record<RoleType, number> = {
  moderator:           5,
  financial_analyst:   2,
  community_manager:   2,
};

export const CAP_KEY = (role: RoleType) => `staff_cap_${role}`;

// Extended type: staff_roles row with joined profile
export type StaffWithProfile = {
  id:          string;
  user_id:     string;
  role_type:   string | null;
  permissions: Record<string, unknown> | null;
  is_active:   boolean | null;
  created_at:  string | null;
  user_id_profile: {
    full_name:         string;
    email:             string;
    profile_image_url: string | null;
    trust_score:       number | null;
  } | null;
};

export type ActionLogRow = {
  id:               string;
  admin_id:         string;
  target_user_id:   string | null;
  action_type:      string;
  reason:           string | null;
  created_at:       string | null;
  is_reversed:      boolean | null;
  reversible_until: string | null;
};

// ─── Server Actions ───────────────────────────────────────────────────────────

async function activateStaffSystem() {
  'use server';
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  await supabase.from('platform_config').upsert(
    {
      key:          'staff_system_active',
      enabled:      true,
      description:  'Controls whether the staff management system is active.',
      value:        null,
      string_value: null,
    },
    { onConflict: 'key' }
  );

  // Seed default caps (ignoreDuplicates so re-activation doesn't overwrite tuned values)
  await supabase.from('platform_config').upsert(
    ROLE_TYPES.map((role) => ({
      key:          CAP_KEY(role),
      enabled:      true,
      description:  `Maximum active ${role.replace(/_/g, ' ')} staff members.`,
      value:        DEFAULT_CAPS[role],
      string_value: null,
    })),
    { onConflict: 'key', ignoreDuplicates: true }
  );

  await supabase.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'activate_staff_system',
    reason:      'Staff system manually activated by admin.',
  });

  revalidatePath('/f9-control/staff');
}

async function appointStaff(fd: FormData) {
  'use server';
  const userId   = fd.get('user_id')   as string;
  const roleType = fd.get('role_type') as RoleType;
  if (!ROLE_TYPES.includes(roleType)) throw new Error('Invalid role');

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  await supabase
    .from('staff_roles')
    .upsert(
      { user_id: userId, role_type: roleType, is_active: true, permissions: {} },
      { onConflict: 'user_id' }
    );

  await supabase.from('notifications').insert({
    user_id: userId,
    type:    'staff_invite',
    title:   'You have been appointed to the F9 team',
    message: `You have been appointed as a ${roleType.replace(/_/g, ' ')} on F9. Your staff console access is now active.`,
  });

  await supabase.from('admin_action_logs').insert({
    admin_id:         admin.id,
    target_user_id:   userId,
    action_type:      'appoint_staff',
    reason:           `Appointed as ${roleType.replace(/_/g, ' ')}`,
    reversible_until: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  });

  revalidatePath('/f9-control/staff');
}

async function revokeStaff(fd: FormData) {
  'use server';
  const staffRoleId = fd.get('staff_role_id') as string;
  const userId      = fd.get('user_id')       as string;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  await supabase.from('staff_roles').update({ is_active: false }).eq('id', staffRoleId);

  await supabase.from('notifications').insert({
    user_id: userId,
    type:    'staff_revoked',
    title:   'Staff Access Revoked',
    message: 'Your staff access to the F9 platform has been revoked.',
  });

  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: userId,
    action_type:    'revoke_staff',
    reason:         'Staff access revoked by admin',
  });

  revalidatePath('/f9-control/staff');
}

async function updateStaffCap(fd: FormData) {
  'use server';
  const role   = fd.get('role') as RoleType;
  const newCap = Number(fd.get('cap'));
  if (!ROLE_TYPES.includes(role) || isNaN(newCap) || newCap < 1) throw new Error('Invalid input');

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  await supabase.from('platform_config').update({ value: newCap }).eq('key', CAP_KEY(role));

  await supabase.from('admin_action_logs').insert({
    admin_id:    admin.id,
    action_type: 'update_staff_cap',
    reason:      `${role.replace(/_/g, ' ')} cap updated to ${newCap}`,
  });

  revalidatePath('/f9-control/staff');
}

async function grantElevatedPermission(fd: FormData) {
  'use server';
  const staffRoleId   = fd.get('staff_role_id')   as string;
  const userId        = fd.get('user_id')          as string;
  const permissionKey = fd.get('permission_key')   as string;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const { data: current } = await supabase.from('staff_roles').select('permissions').eq('id', staffRoleId).single();
  const perms = { ...(typeof current?.permissions === 'object' && current.permissions ? current.permissions as Record<string, unknown> : {}), [permissionKey]: true };

  await supabase.from('staff_roles').update({ permissions: perms }).eq('id', staffRoleId);
  await supabase.from('admin_action_logs').insert({
    admin_id: admin.id, target_user_id: userId,
    action_type: 'grant_elevated_permission',
    reason: `Elevated permission '${permissionKey}' granted`,
  });

  revalidatePath('/f9-control/staff');
}

async function revokeElevatedPermission(fd: FormData) {
  'use server';
  const staffRoleId   = fd.get('staff_role_id')   as string;
  const userId        = fd.get('user_id')          as string;
  const permissionKey = fd.get('permission_key')   as string;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const { data: current } = await supabase.from('staff_roles').select('permissions').eq('id', staffRoleId).single();
  const perms = { ...(typeof current?.permissions === 'object' && current.permissions ? current.permissions as Record<string, unknown> : {}) };
  delete perms[permissionKey];

  await supabase.from('staff_roles').update({ permissions: perms }).eq('id', staffRoleId);
  await supabase.from('admin_action_logs').insert({
    admin_id: admin.id, target_user_id: userId,
    action_type: 'revoke_elevated_permission',
    reason: `Elevated permission '${permissionKey}' revoked`,
  });

  revalidatePath('/f9-control/staff');
}

/** Calls the existing reverse_admin_action RPC (schema-verified). */
async function reverseStaffAction(fd: FormData) {
  'use server';
  const logId = fd.get('log_id') as string;
  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const { error } = await supabase.rpc('reverse_admin_action', {
    p_log_id:      logId,
    p_reversed_by: admin.id,
  });

  if (error) throw error;
  revalidatePath('/f9-control/staff');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StaffPage() {
  const supabase = await createClient();

  const { data: activationConfig } = await supabase
    .from('platform_config')
    .select('enabled')
    .eq('key', 'staff_system_active')
    .single();

  const isActive = activationConfig?.enabled === true;

  // ── Dormant ───────────────────────────────────────────────────────────────
  if (!isActive) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
        <DormantState onActivate={activateStaffSystem} />
      </div>
    );
  }

  // ── Active — fetch all data ───────────────────────────────────────────────
  const { data: staffRoles } = await supabase
    .from('staff_roles')
    .select(`
      id,
      user_id,
      role_type,
      permissions,
      is_active,
      created_at,
      user_id_profile:user_id(full_name, email, profile_image_url, trust_score)
    `)
    .order('created_at', { ascending: false }) as { data: StaffWithProfile[] | null };

  const staffUserIds = (staffRoles ?? []).map((s) => s.user_id);

  const { data: actionLog } = await supabase
    .from('admin_action_logs')
    .select('id, admin_id, target_user_id, action_type, reason, created_at, is_reversed, reversible_until')
    .in('admin_id', staffUserIds.length > 0 ? staffUserIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: false })
    .limit(100) as { data: ActionLogRow[] | null };

  const { data: capConfigs } = await supabase
    .from('platform_config')
    .select('key, value')
    .in('key', ROLE_TYPES.map(CAP_KEY));

  const caps: Record<RoleType, number> = { ...DEFAULT_CAPS };
  capConfigs?.forEach((c) => {
    const role = c.key.replace('staff_cap_', '') as RoleType;
    if (ROLE_TYPES.includes(role) && c.value !== null) caps[role] = c.value;
  });

  const activeCounts: Record<RoleType, number> = {
    moderator: 0, financial_analyst: 0, community_manager: 0,
  };
  (staffRoles ?? []).filter((s) => s.is_active).forEach((s) => {
    const role = s.role_type as RoleType;
    if (ROLE_TYPES.includes(role)) activeCounts[role]++;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your team. Every action is logged and visible only to you.
        </p>
      </div>

      <StaffClient
        staffRoles={staffRoles ?? []}
        actionLog={actionLog ?? []}
        caps={caps}
        activeCounts={activeCounts}
        onAppointStaff={appointStaff}
        onRevokeStaff={revokeStaff}
        onUpdateStaffCap={updateStaffCap}
        onGrantElevatedPermission={grantElevatedPermission}
        onRevokeElevatedPermission={revokeElevatedPermission}
        onReverseAction={reverseStaffAction}
      />
    </div>
  );
}

// ─── Dormant state (server-rendered — no 'use client' needed) ─────────────────

function DormantState({ onActivate }: { onActivate: () => Promise<void> }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="max-w-md space-y-6">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Staff management is currently inactive.
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Activate when you&apos;re ready to bring on your first team member.
            The architecture is already in place — this simply turns on the UI
            and seeds the default role caps.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left text-xs text-amber-800 space-y-1.5">
          <p className="font-semibold">Before activating, be aware:</p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>Roles: Moderator · Financial Analyst · Community Manager</li>
            <li>Every staff action is permanently logged, visible only to you</li>
            <li>Staff can reverse their own actions within 48 hours</li>
            <li>You can revoke any staff member instantly at any time</li>
          </ul>
        </div>

        <form action={onActivate}>
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Activate Staff System
          </button>
        </form>
      </div>
    </div>
  );
}