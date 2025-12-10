// src/lib/security/audit.ts
export async function logAuditEvent(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: any,
  request?: NextRequest
) {
  const supabase = createClient();
  
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

// Usage:
await logAuditEvent(
  user.id,
  'order_completed',
  'order',
  orderId,
  { amount: 50000 },
  request
);