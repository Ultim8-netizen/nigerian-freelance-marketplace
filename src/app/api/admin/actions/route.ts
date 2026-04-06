// src/app/api/admin/actions/route.ts
//
// Palette action execution endpoint — called by CommandPalette when the admin
// completes a two-phase action (action selection → user target selection).
//
// Supported actions:
//   warn_user       — inserts a level_1_advisory notification for the target user
//                     and logs to admin_action_logs
//   freeze_wallet   — sets wallets.is_frozen = true, frozen_at = now()
//                     REQUIRES migration: 20260406_add_wallet_frozen.sql
//   unfreeze_wallet — sets wallets.is_frozen = false, frozen_at = null
//                     REQUIRES migration: 20260406_add_wallet_frozen.sql
//   suspend_user    — sets profiles.account_status = 'suspended'
//   unsuspend_user  — sets profiles.account_status = 'active'
//
// Auth: caller must be an active admin (verified against profiles.user_type).
// All mutations go through createAdminClient() (service role) so RLS is bypassed.
// Every successful mutation is recorded in admin_action_logs.

import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@/lib/supabase/server';
import { createAdminClient }         from '@/lib/supabase/admin';

type ActionId =
  | 'warn_user'
  | 'freeze_wallet'
  | 'unfreeze_wallet'
  | 'suspend_user'
  | 'unsuspend_user';

interface ActionBody {
  action:         ActionId;
  target_user_id: string;
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth guard ────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (!adminProfile || adminProfile.user_type !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // ── 2. Parse + validate body ─────────────────────────────────────────────
    let body: ActionBody;
    try {
      body = await req.json() as ActionBody;
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const { action, target_user_id } = body;

    const VALID_ACTIONS: ActionId[] = [
      'warn_user', 'freeze_wallet', 'unfreeze_wallet', 'suspend_user', 'unsuspend_user',
    ];

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    if (!target_user_id || typeof target_user_id !== 'string') {
      return NextResponse.json({ success: false, error: 'target_user_id is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // ── 3. Verify target user exists ─────────────────────────────────────────
    const { data: targetProfile, error: targetErr } = await adminClient
      .from('profiles')
      .select('id, full_name, account_status')
      .eq('id', target_user_id)
      .single();

    if (targetErr || !targetProfile) {
      return NextResponse.json({ success: false, error: 'Target user not found' }, { status: 404 });
    }

    let actionDescription = '';
    let mutationError: unknown = null;

    // ── 4. Execute mutation ──────────────────────────────────────────────────
    switch (action) {

      case 'warn_user': {
        const { error } = await adminClient.from('notifications').insert({
          user_id: target_user_id,
          type:    'level_1_advisory',
          title:   'Advisory Notice — We Noticed Something',
          message:
            'Our systems flagged some recent activity on your account. ' +
            'This is an early heads-up before any formal action. ' +
            'Please review our Community Guidelines. If you have questions, contact support.',
        });
        mutationError    = error;
        actionDescription = `Level 1 advisory issued to ${targetProfile.full_name}`;
        break;
      }

      case 'freeze_wallet': {
        // Requires migration: 20260406_add_wallet_frozen.sql
        // Cast required until `supabase gen types` is re-run after migration.
        const { error } = await adminClient
          .from('wallets')
          .update({
            is_frozen: true,
            frozen_at: new Date().toISOString(),
          } as { is_frozen: boolean; frozen_at: string })
          .eq('user_id', target_user_id);
        mutationError    = error;
        actionDescription = `Wallet frozen for ${targetProfile.full_name}`;

        if (!error) {
          // Notify user
          await adminClient.from('notifications').insert({
            user_id: target_user_id,
            type:    'wallet_frozen',
            title:   'Wallet Temporarily Frozen',
            message:
              'Your wallet has been temporarily frozen by an admin pending review. ' +
              'Your account remains active. Please contact support if you believe this is an error.',
          });
        }
        break;
      }

      case 'unfreeze_wallet': {
        // Requires migration: 20260406_add_wallet_frozen.sql
        const { error } = await adminClient
          .from('wallets')
          .update({
            is_frozen: false,
            frozen_at: null,
          } as { is_frozen: boolean; frozen_at: string | null })
          .eq('user_id', target_user_id);
        mutationError    = error;
        actionDescription = `Wallet unfrozen for ${targetProfile.full_name}`;

        if (!error) {
          await adminClient.from('notifications').insert({
            user_id: target_user_id,
            type:    'wallet_frozen',
            title:   'Wallet Unfrozen',
            message:
              'Your wallet freeze has been lifted. You can now withdraw and transact normally.',
          });
        }
        break;
      }

      case 'suspend_user': {
        const { error } = await adminClient
          .from('profiles')
          .update({ account_status: 'suspended' })
          .eq('id', target_user_id);
        mutationError    = error;
        actionDescription = `Account suspended for ${targetProfile.full_name}`;

        if (!error) {
          await adminClient.from('notifications').insert({
            user_id: target_user_id,
            type:    'account_suspended',
            title:   'Your Account Has Been Suspended',
            message:
              'Your F9 account has been suspended pending admin review. ' +
              'Please contact support if you believe this was made in error.',
          });
        }
        break;
      }

      case 'unsuspend_user': {
        const { error } = await adminClient
          .from('profiles')
          .update({ account_status: 'active' })
          .eq('id', target_user_id);
        mutationError    = error;
        actionDescription = `Account reinstated for ${targetProfile.full_name}`;

        if (!error) {
          await adminClient.from('notifications').insert({
            user_id: target_user_id,
            type:    'account_reinstated',
            title:   'Your Account Has Been Reinstated',
            message:
              'Your F9 account is now active again. Welcome back.',
          });
        }
        break;
      }
    }

    if (mutationError) {
      console.error(`[admin/actions] ${action} failed:`, mutationError);
      return NextResponse.json(
        { success: false, error: 'Mutation failed — check server logs' },
        { status: 500 },
      );
    }

    // ── 5. Audit log ─────────────────────────────────────────────────────────
    await adminClient.from('admin_action_logs').insert({
      admin_id:       user.id,
      target_user_id,
      action_type:    action,
      reason:         `[Command Palette] ${actionDescription}`,
    });

    return NextResponse.json({ success: true, message: actionDescription });

  } catch (error) {
    console.error('[admin/actions] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}