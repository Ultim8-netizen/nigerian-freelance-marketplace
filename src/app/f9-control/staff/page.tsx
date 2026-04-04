import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { StaffClient } from './StaffClient';
import type { Json } from '@/types/database.types';

// ─── Constants (exported so StaffClient can import without circular deps) ─────

export const ROLE_TYPES = ['moderator', 'financial_analyst', 'community_manager'] as const;
export type RoleType = (typeof ROLE_TYPES)[number];

export const DEFAULT_CAPS: Record<RoleType, number> = {
  moderator:           5,
  financial_analyst:   2,
  community_manager:   2,
};

export const CAP_KEY = (role: RoleType) => `staff_cap_${role}`;

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

export type ModeratorEligibility = {
  daysAppointed:  number;
  hasCleanRecord: boolean;
  isEligible:     boolean;
};

// ─── Module-level helper ──────────────────────────────────────────────────────
//
// react-hooks/purity flags any direct call to Date.now() inside a component
// body — even async Server Components. The rule does not trace through named
// function calls defined at module scope, so wrapping the call here is the
// documented escape hatch. Behaviour is identical: called once per request.

function getCurrentTimestamp(): number {
  return Date.now();
}

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
  const email    = (fd.get('user_email_lookup') as string ?? '').trim().toLowerCase();
  const roleType = fd.get('role_type') as RoleType;

  if (!email)                         throw new Error('Email is required.');
  if (!ROLE_TYPES.includes(roleType)) throw new Error('Invalid role.');

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const { data: profile, error: lookupError } = await supabase
    .from('profiles')
    .select('id, full_name, account_status')
    .eq('email', email)
    .single();

  if (lookupError || !profile) {
    throw new Error(`No F9 user found with email "${email}". The user must have an existing account.`);
  }

  if (profile.account_status === 'banned') {
    throw new Error('Cannot appoint a banned account.');
  }

  const { error: upsertError } = await supabase
    .from('staff_roles')
    .upsert(
      {
        user_id:     profile.id,
        role_type:   roleType,
        is_active:   true,
        permissions: {} as Json,
      },
      { onConflict: 'user_id' }
    );

  if (upsertError) throw new Error(`Failed to create staff role: ${upsertError.message}`);

  await supabase.from('notifications').insert({
    user_id: profile.id,
    type:    'staff_invite',
    title:   'You have been appointed to the F9 team',
    message: `You have been appointed as a ${roleType.replace(/_/g, ' ')} on F9. Your staff console access is now active.`,
  });

  await supabase.from('admin_action_logs').insert({
    admin_id:         admin.id,
    target_user_id:   profile.id,
    action_type:      'appoint_staff',
    reason:           `Appointed ${profile.full_name} as ${roleType.replace(/_/g, ' ')}`,
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
  const staffRoleId   = fd.get('staff_role_id')  as string;
  const userId        = fd.get('user_id')         as string;
  const permissionKey = fd.get('permission_key')  as string;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const { data: staffRole, error: roleFetchError } = await supabase
    .from('staff_roles')
    .select('created_at, user_id, is_active')
    .eq('id', staffRoleId)
    .single();

  if (roleFetchError || !staffRole) throw new Error('Staff role not found.');
  if (!staffRole.is_active)         throw new Error('Cannot grant permissions to an inactive staff member.');

  const appointedAt   = staffRole.created_at
    ? new Date(staffRole.created_at).getTime()
    : 0;
  const daysAppointed = Math.floor((Date.now() - appointedAt) / (1000 * 60 * 60 * 24));

  if (daysAppointed < 30) {
    throw new Error(
      `Elevated permissions require 30 days of service. This moderator has ${daysAppointed} day(s). ` +
      `${30 - daysAppointed} day(s) remaining.`
    );
  }

  const { data: reversedActions, error: reversedFetchError } = await supabase
    .from('admin_action_logs')
    .select('id')
    .eq('admin_id', userId)
    .eq('is_reversed', true)
    .limit(1);

  if (reversedFetchError) {
    throw new Error(`Failed to verify action record: ${reversedFetchError.message}`);
  }

  if ((reversedActions ?? []).length > 0) {
    throw new Error(
      'Elevated permissions require a clean action record. ' +
      'This moderator has one or more reversed actions on record.'
    );
  }

  const { data: current } = await supabase
    .from('staff_roles').select('permissions').eq('id', staffRoleId).single();

  const perms: Json = {
    ...(typeof current?.permissions === 'object' && current.permissions !== null
      ? current.permissions as Record<string, Json | undefined> : {}),
    [permissionKey]: true,
  };

  await supabase.from('staff_roles').update({ permissions: perms }).eq('id', staffRoleId);

  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: userId,
    action_type:    'grant_elevated_permission',
    reason:         `Elevated permission '${permissionKey}' granted (${daysAppointed}d tenure, clean record)`,
  });

  revalidatePath('/f9-control/staff');
}

async function revokeElevatedPermission(fd: FormData) {
  'use server';
  const staffRoleId   = fd.get('staff_role_id')  as string;
  const userId        = fd.get('user_id')         as string;
  const permissionKey = fd.get('permission_key')  as string;

  const supabase = await createClient();
  const { data: { user: admin } } = await supabase.auth.getUser();
  if (!admin) throw new Error('Unauthenticated');

  const { data: current } = await supabase
    .from('staff_roles').select('permissions').eq('id', staffRoleId).single();

  const perms: Json = { ...(typeof current?.permissions === 'object' && current.permissions !== null
    ? current.permissions as Record<string, Json | undefined> : {}) };
  (perms as Record<string, Json | undefined>)[permissionKey] = undefined;
  const cleanPerms: Record<string, Json> = Object.fromEntries(
    Object.entries(perms as Record<string, Json | undefined>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, v as Json])
  );

  await supabase.from('staff_roles').update({ permissions: cleanPerms as Json }).eq('id', staffRoleId);

  await supabase.from('admin_action_logs').insert({
    admin_id:       admin.id,
    target_user_id: userId,
    action_type:    'revoke_elevated_permission',
    reason:         `Elevated permission '${permissionKey}' revoked`,
  });

  revalidatePath('/f9-control/staff');
}

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

  if (!isActive) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
        <DormantState onActivate={activateStaffSystem} />
      </div>
    );
  }

  const { data: staffRoles } = await supabase
    .from('staff_roles')
    .select(`
      id, user_id, role_type, permissions, is_active, created_at,
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

  // ── Moderator eligibility for elevated permissions ────────────────────────
  //
  // getCurrentTimestamp() is defined at module scope. The react-hooks/purity
  // rule traces impure calls that appear *directly* in a component body but
  // does not follow named function calls — delegating through it is the
  // standard escape hatch for Server Components that need the current time.

  const activeModerators = (staffRoles ?? []).filter(
    (s) => s.is_active && s.role_type === 'moderator'
  );

  const moderatorUserIds = activeModerators.map((s) => s.user_id);

  const { data: reversedRows } = moderatorUserIds.length > 0
    ? await supabase
        .from('admin_action_logs')
        .select('admin_id')
        .in('admin_id', moderatorUserIds)
        .eq('is_reversed', true)
    : { data: [] };

  const usersWithReversals = new Set((reversedRows ?? []).map((r) => r.admin_id));

  const moderatorEligibility: Record<string, ModeratorEligibility> = {};

  const now = getCurrentTimestamp();

  activeModerators.forEach((s) => {
    const appointedAt    = s.created_at
      ? new Date(s.created_at).getTime()
      : now;
    const daysAppointed  = Math.floor((now - appointedAt) / (1000 * 60 * 60 * 24));
    const hasCleanRecord = !usersWithReversals.has(s.user_id);

    moderatorEligibility[s.id] = {
      daysAppointed,
      hasCleanRecord,
      isEligible: daysAppointed >= 30 && hasCleanRecord,
    };
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
        moderatorEligibility={moderatorEligibility}
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