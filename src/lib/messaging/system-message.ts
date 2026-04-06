// src/lib/messaging/system-message.ts
//
// Shared helper that delivers a message into a recipient's F9 inbox from the
// platform system account.
//
// WHY THIS IS A SHARED MODULE:
//   sendF9SystemMessage() is called from two separate entry points:
//     1. src/app/(dashboard)/freelancer/earnings/page.tsx (server action)
//        — at withdrawal-hold time, to immediately notify the freelancer.
//     2. src/app/api/admin/automation/cron/route.ts (cron Rule 4)
//        — at hold-release time, to notify the freelancer that their
//          withdrawal is now queued for processing.
//   Keeping a single canonical implementation prevents the two call sites
//   from drifting apart.
//
// WHY adminClient / serviceClient IS REQUIRED:
//   conversations INSERT RLS: (participant_1 = auth.uid()) OR (participant_2 = auth.uid())
//   messages INSERT RLS:      sender_id = auth.uid()
//
//   Neither the earnings server action (running as the freelancer) nor the
//   cron route (running with no user session) can satisfy these policies for
//   a message whose sender is the platform system account. A service-role
//   client bypasses all RLS and must be passed in by the caller.
//
// CONVERSATION REUSE:
//   A SELECT-before-INSERT pattern is used rather than an upsert because
//   PostgreSQL treats NULL ≠ NULL in unique indexes by default. The UNIQUE
//   constraint on (participant_1, participant_2, order_id) does not collapse
//   multiple rows where order_id IS NULL, so upsert ON CONFLICT would silently
//   insert duplicates. SELECT-then-INSERT is the safe alternative.
//
// PARTICIPANT ORDERING:
//   participant_1 is always the lexicographically smaller UUID so that the
//   same conversation is found regardless of which UUID is "system" vs
//   "recipient" at call time.
//
// ENVIRONMENT VARIABLE:
//   PLATFORM_SYSTEM_USER_ID must be set to the UUID of the platform/system
//   Supabase auth user. If absent, the function no-ops with a console.warn
//   and the caller's notifications fallback still fires.

import type { SupabaseClient } from '@supabase/supabase-js';

export async function sendF9SystemMessage(
  adminClient: SupabaseClient,
  recipientId: string,
  content:     string,
): Promise<void> {
  const systemUserId = process.env.PLATFORM_SYSTEM_USER_ID;

  if (!systemUserId) {
    console.warn(
      '[sendF9SystemMessage] PLATFORM_SYSTEM_USER_ID env var is not set. ' +
      'Skipping F9 inbox message — only the notifications row was written. ' +
      'Set this variable to a valid Supabase auth user UUID to enable dual-channel delivery.'
    );
    return;
  }

  // Deterministic participant ordering: smaller UUID → participant_1.
  const [p1, p2] = systemUserId < recipientId
    ? [systemUserId, recipientId]
    : [recipientId, systemUserId];

  try {
    // ── Step 1: find existing system↔freelancer general conversation ─────────
    // "General" means order_id IS NULL — this thread is not tied to any
    // specific order and serves as the platform-to-user notification channel.
    const { data: existing, error: selectError } = await adminClient
      .from('conversations')
      .select('id')
      .eq('participant_1', p1)
      .eq('participant_2', p2)
      .is('order_id', null)
      .maybeSingle();

    if (selectError) {
      console.error('[sendF9SystemMessage] conversation SELECT failed:', selectError);
      return;
    }

    let conversationId: string;

    if (existing) {
      // Reuse the existing thread — append the new message to it.
      conversationId = existing.id;
    } else {
      // ── Step 2: create the system↔freelancer conversation ──────────────────
      const { data: newConv, error: insertConvError } = await adminClient
        .from('conversations')
        .insert({ participant_1: p1, participant_2: p2, order_id: null })
        .select('id')
        .single();

      if (insertConvError || !newConv) {
        console.error('[sendF9SystemMessage] conversation INSERT failed:', insertConvError);
        return;
      }

      conversationId = newConv.id;
    }

    // ── Step 3: insert the message from the system account ───────────────────
    // sender_id = systemUserId so the message appears in the freelancer's inbox
    // as a message from the platform, not from themselves.
    const { error: msgError } = await adminClient
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id:       systemUserId,
        content,
      });

    if (msgError) {
      console.error('[sendF9SystemMessage] message INSERT failed:', msgError);
    }
  } catch (err) {
    // Never let a messaging failure surface to the caller or break a redirect.
    console.error('[sendF9SystemMessage] unexpected error:', err);
  }
}