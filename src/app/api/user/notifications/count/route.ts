// src/app/api/user/notifications/count/route.ts
//
// Returns the unread notification count for the authenticated user.
// Consumed by UserNotificationBell on a 30-second poll and on every
// Supabase Realtime INSERT/UPDATE event for the user's notifications.
//
// Deliberately minimal: head=true means PostgREST returns only the count
// header with no row bodies, keeping payload small across every poll tick.

import { NextResponse }  from 'next/server';
import { createClient }  from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('[/api/user/notifications/count] query error:', error);
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    return NextResponse.json({ count: count ?? 0 });
  } catch (err) {
    console.error('[/api/user/notifications/count] unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}