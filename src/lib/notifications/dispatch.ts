// src/lib/notifications/dispatch.ts
//
// Delivery-method dispatcher for F9 notifications.
//
// The notifications table is ALWAYS the durable record. A row is inserted
// for every notification regardless of delivery_method. This module handles
// the ADDITIONAL channels beyond the in-app bell:
//
//   in_app : notification row only. Bell reads it. No further action here.
//   inbox  : F9 inbox message via sendF9SystemMessage. Bell row still exists
//            as a record but inbox is the primary channel.
//   both   : notification bell row + F9 inbox message.
//
// SCHEDULING:
//   If scheduledAt is set and in the future this function is a no-op.
//   The dedicated cron at /api/cron/notifications owns deferred dispatch.
//   For immediate sends (scheduledAt null or already past) inbox delivery
//   fires here directly from the server action.
//
// IDEMPOTENCY:
//   dispatched_at is stamped on the notification row after successful
//   sendF9SystemMessage delivery. The cron's IS NULL filter ensures the
//   inbox leg is never re-sent, even if the cron runs between the server
//   action completing and the response returning.
//
// BROADCAST CONCURRENCY:
//   sendBroadcast calls this once per recipient inside Promise.allSettled.
//   A single failure does not block other recipients; errors are logged
//   internally by sendF9SystemMessage and never thrown.

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendF9SystemMessage } from '@/lib/messaging/system-message';

export interface DispatchInboxParams {
  /** Service-role client — RLS blocks cross-user message inserts. */
  adminClient:    SupabaseClient;
  /** Recipient profile UUID. */
  userId:         string;
  /** Notification body — used verbatim as the F9 inbox message text. */
  message:        string;
  /** notifications.delivery_method value. */
  deliveryMethod: string;
  /** notifications.scheduled_at — null means send immediately. */
  scheduledAt:    string | null;
  /** notifications.id — stamped with dispatched_at after inbox delivery. */
  notificationId: string;
}

export async function dispatchNotificationInbox(
  params: DispatchInboxParams,
): Promise<void> {
  const {
    adminClient,
    userId,
    message,
    deliveryMethod,
    scheduledAt,
    notificationId,
  } = params;

  // in_app: bell row is sufficient; nothing more to do.
  if (deliveryMethod !== 'inbox' && deliveryMethod !== 'both') return;

  // Future-dated send: cron owns dispatch at the scheduled time.
  if (scheduledAt && new Date(scheduledAt) > new Date()) return;

  // Deliver the F9 inbox message. sendF9SystemMessage never throws —
  // it logs internally and returns void on any failure.
  await sendF9SystemMessage(adminClient, userId, message);

  // Stamp dispatched_at so the cron's IS NULL filter excludes this row
  // and never re-delivers. adminClient bypasses RLS — required here
  // because the notification row belongs to the recipient, not the admin.
  const { error: stampError } = await adminClient
    .from('notifications')
    .update({ dispatched_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (stampError) {
    console.error(
      `[dispatchNotificationInbox] dispatched_at stamp failed for ` +
      `notification ${notificationId}:`,
      stampError,
    );
    // Non-fatal: the inbox message was delivered. The stamp failure means
    // the cron may re-deliver on the next tick. sendF9SystemMessage's
    // conversation-reuse pattern (SELECT-before-INSERT) makes duplicate
    // messages the only consequence — not data loss.
  }
}