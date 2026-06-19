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
//
// WHY adminClient IS REQUIRED:
//   conversations INSERT RLS: (participant_1 = auth.uid()) OR (participant_2 = auth.uid())
//   messages INSERT RLS:      sender_id = auth.uid()
//   Neither caller can satisfy these policies for a message whose sender is
//   the platform system account. Service-role client bypasses all RLS.
//
// PARTICIPANT ORDERING:
//   participant_1 is always the lexicographically smaller UUID so the same
//   conversation is located regardless of which UUID is "system" vs "recipient".
//
// ENVIRONMENT VARIABLE:
//   PLATFORM_SYSTEM_USER_ID — UUID of the platform Supabase auth user.
//   If absent the function no-ops; the caller's notifications fallback fires.

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
    // ── Step 1: find existing system↔user general conversation ───────────────
    // order_id IS NULL = platform-to-user notification thread, not tied to
    // any specific order.
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
      conversationId = existing.id;
    } else {
      // ── Step 2: create the system↔user conversation ───────────────────────
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

    // ── Step 3: insert the message ────────────────────────────────────────────
    // Column is message_text (schema-verified in database.types.ts).
    const { error: msgError } = await adminClient
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id:       systemUserId,
        message_text:    content,
      });

    if (msgError) {
      console.error('[sendF9SystemMessage] message INSERT failed:', msgError);
      // Do not proceed to last_message_at update — the message didn't land.
      return;
    }

    // ── Step 4: update last_message_at ───────────────────────────────────────
    // FIX (Bug B): without this update the conversation sorts by its creation
    // time in the user's sidebar, meaning system messages (withdrawal holds,
    // hold-release notifications) permanently appear at the bottom regardless
    // of recency. Fire-and-forget per F9 protocol — a timestamp failure must
    // not propagate to the caller or break a redirect.
    void (async () => {
      const { error: tsError } = await adminClient
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (tsError) {
        console.error('[sendF9SystemMessage] last_message_at update failed:', tsError);
      }
    })();

  } catch (err) {
    // Never let a messaging failure surface to the caller or break a redirect.
    console.error('[sendF9SystemMessage] unexpected error:', err);
  }
}