// src/app/api/admin/search/route.ts
// Cross-reference search endpoint for the admin Command Palette.
//
// Queries four sources simultaneously:
//   profiles        — matched by full_name, email, or user ID prefix
//   transactions    — matched by transaction_ref (the human-readable ref column)
//                     or id; joined to orders.client_id → profiles.full_name
//   orders          — matched by id prefix; joined to profiles for client name
//   contest_tickets — matched by id prefix or action_contested text
//
// Schema ground-truth (verified against DB exports):
//   profiles:        id, full_name, email, user_type  (NO display_name)
//   transactions:    id, transaction_ref, order_id, amount, status, transaction_type
//                    (NO standalone `reference` column)
//   orders:          id, client_id, freelancer_id, title, amount, status
//                    (no admin RLS — service role required)
//   contest_tickets: id, user_id, action_contested, explanation, status, created_at
//                    (NO `subject` column)
//
// All four tables have RLS enabled but NO admin-level policy, so every query
// here goes through createAdminClient() (service role).

import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@/lib/supabase/server';
import { createAdminClient }         from '@/lib/supabase/admin';
import { logger }                    from '@/lib/logger';

export interface SearchResult {
  id:          string;   // stable React key — prefixed by type
  type:        'user' | 'transaction' | 'order' | 'flag';
  label:       string;   // primary display text
  description: string;   // secondary line (ID, status, amount, etc.)
  href:        string;   // palette navigates here on select
}

const MAX_PER_TABLE = 4; // 4 sources × 4 rows = 16 max results

export async function GET(req: NextRequest) {
  try {
    // ── 1. Auth guard ───────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (!profile || profile.user_type !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // ── 2. Validate query ───────────────────────────────────────────────────
    const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';

    if (q.length < 2) {
      return NextResponse.json({ success: true, results: [] });
    }

    const adminClient = createAdminClient();
    const like        = `%${q}%`;

    // ── 3. Fan-out — all four sources run concurrently ──────────────────────
    const [usersRes, txnsRes, ordersRes, flagsRes] = await Promise.all([

      // profiles — full_name, email, or partial UUID
      // RLS: "Public profiles viewable by all" covers SELECT,
      // but we use adminClient for consistency and to include suspended accounts.
      adminClient
        .from('profiles')
        .select('id, full_name, email, user_type')
        .or(`full_name.ilike.${like},email.ilike.${like},id.ilike.${like}`)
        .limit(MAX_PER_TABLE),

      // transactions — match on transaction_ref (human ref) or row id.
      // Join client name via order_id → orders.client_id → profiles.full_name.
      // Supabase embedded select for the join: transactions → orders → profiles.
      adminClient
        .from('transactions')
        .select(`
          id,
          transaction_ref,
          amount,
          status,
          transaction_type,
          order:orders!transactions_order_id_fkey (
            client:profiles!orders_client_id_fkey ( full_name )
          )
        `)
        .or(`transaction_ref.ilike.${like},id.ilike.${like}`)
        .limit(MAX_PER_TABLE),

      // orders — match on id prefix; join client full_name.
      // No admin RLS policy exists on orders — service role required.
      adminClient
        .from('orders')
        .select(`
          id,
          title,
          amount,
          status,
          client:profiles!orders_client_id_fkey ( full_name )
        `)
        .or(`id.ilike.${like},title.ilike.${like}`)
        .limit(MAX_PER_TABLE),

      // contest_tickets — match on id prefix or action_contested text.
      // Columns: id, action_contested, explanation, status, created_at.
      // (No `subject` column exists in this table.)
      adminClient
        .from('contest_tickets')
        .select('id, action_contested, status, created_at')
        .or(`id.ilike.${like},action_contested.ilike.${like}`)
        .limit(MAX_PER_TABLE),
    ]);

    // ── 4. Log partial failures — don't abort the whole response ───────────
    if (usersRes.error)  logger.error('Admin search: profiles query failed',          usersRes.error);
    if (txnsRes.error)   logger.error('Admin search: transactions query failed',      txnsRes.error);
    if (ordersRes.error) logger.error('Admin search: orders query failed',            ordersRes.error);
    if (flagsRes.error)  logger.error('Admin search: contest_tickets query failed',   flagsRes.error);

    // ── 5. Shape into a flat SearchResult array ─────────────────────────────
    const results: SearchResult[] = [];

    // Users
    for (const row of usersRes.data ?? []) {
      results.push({
        id:          `user-${row.id}`,
        type:        'user',
        label:       row.full_name ?? row.email ?? 'Unknown user',
        description: `${row.user_type} · ${row.email ?? row.id}`,
        href:        `/f9-control/users/${row.id}`,
      });
    }

    // Transactions
    for (const row of txnsRes.data ?? []) {
      const clientName = (row.order as { client?: { full_name?: string } } | null)
        ?.client?.full_name ?? '';
      const amount     = row.amount != null
        ? `₦${Number(row.amount).toLocaleString('en-NG')}`
        : '';
      results.push({
        id:          `txn-${row.id}`,
        type:        'transaction',
        label:       row.transaction_ref ?? row.id,
        description: [row.transaction_type, amount, row.status, clientName]
          .filter(Boolean).join(' · '),
        href:        `/f9-control/finance?search=${encodeURIComponent(row.transaction_ref ?? row.id)}`,
      });
    }

    // Orders
    for (const row of ordersRes.data ?? []) {
      const clientName = (row.client as { full_name?: string } | null)?.full_name ?? 'Unknown client';
      const amount     = row.amount != null
        ? `₦${Number(row.amount).toLocaleString('en-NG')}`
        : '';
      results.push({
        id:          `order-${row.id}`,
        type:        'order',
        label:       row.title ?? `Order ${row.id.slice(0, 8)}…`,
        description: [clientName, amount, row.status].filter(Boolean).join(' · '),
        href:        `/f9-control/finance/orders?search=${encodeURIComponent(row.id)}`,
      });
    }

    // Contest tickets
    for (const row of flagsRes.data ?? []) {
      // Truncate action_contested to keep the label concise in the palette
      const label = row.action_contested.length > 60
        ? `${row.action_contested.slice(0, 57)}…`
        : row.action_contested;
      results.push({
        id:          `flag-${row.id}`,
        type:        'flag',
        label,
        description: `${row.status} · ${row.created_at ? new Date(row.created_at).toLocaleDateString('en-NG') : '—'}`,
        href:        `/f9-control/flags?search=${encodeURIComponent(row.id)}`,
      });
    }

    return NextResponse.json({ success: true, results });

  } catch (error) {
    logger.error('Admin search route error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 },
    );
  }
}