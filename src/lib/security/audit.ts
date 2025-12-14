// src/lib/security/audit.ts

import { NextRequest } from 'next/server'; // Assumed import for NextRequest type
import { createClient } from '@/lib/supabase/server'; // Updated import path to match file location

/**
 * Logs an audit event to the 'audit_logs' table in Supabase.
 *
 * @param userId The ID of the user performing the action.
 * @param action A short description of the action (e.g., 'user_created', 'order_updated').
 * @param resourceType The type of resource affected (e.g., 'user', 'product', 'order').
 * @param resourceId The ID of the affected resource.
 * @param metadata Optional additional data related to the event.
 * @param request Optional NextRequest object to extract IP and User-Agent headers.
 */
export async function logAuditEvent(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, unknown>, // Fix: Replaced 'any' with a more specific type
  request?: NextRequest
) {
  const supabase = await createClient();
  
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    ip_address: request?.headers.get('x-forwarded-for') || null,
    user_agent: request?.headers.get('user-agent') || null,
    metadata,
  });
}

// Usage Example (Commented out to prevent errors caused by undefined variables):
/*
// Assuming 'user', 'orderId', and 'request' are defined in the calling scope
await logAuditEvent(
  user.id,
  'order_completed',
  'order',
  orderId,
  { amount: 50000 },
  request
);
*/