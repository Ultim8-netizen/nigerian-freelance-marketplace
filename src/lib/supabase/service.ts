// src/lib/supabase/service.ts
// Backward-compatibility shim.
//
// The full implementation lives in admin.ts. This file exists only so existing
// call sites importing createServiceClient continue to compile without changes.
//
// Migration path: replace
//   import { createServiceClient } from '@/lib/supabase/service'
// with
//   import { createAdminClient } from '@/lib/supabase/admin'
//
// RULES (unchanged):
//   1. Never import in any file that runs client-side or serves user requests.
//   2. Only use for cron jobs, server-to-server webhooks, background tasks.
//   3. Never expose SUPABASE_SERVICE_ROLE_KEY in any client bundle.

export { createAdminClient as createServiceClient } from './admin';