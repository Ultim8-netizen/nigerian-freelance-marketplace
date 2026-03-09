import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Note: Secure this endpoint in middleware.ts or via Vercel Cron Secret in production
export async function POST() {
  const supabase = await createClient();
  const logs = [];

  // RULE 1: Both parties silent on an open dispute for 7 days → auto-resolve in buyer's favor [cite: 43]
  // FIXED: Use created_at (not updated_at which doesn't exist) to measure 7-day inactivity from dispute creation
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: staleDisputes, error: disputeError } = await supabase
    .from('disputes')
    .select('id, order_id')
    .eq('status', 'open')
    .lte('created_at', sevenDaysAgo);

  if (disputeError) {
    console.error('Error fetching stale disputes:', disputeError);
  }

  if (staleDisputes && staleDisputes.length > 0) {
    for (const dispute of staleDisputes) {
      // FIXED: Handle nullable order_id before update operations
      if (dispute.order_id) {
        await supabase.from('disputes').update({ 
          status: 'resolved_client', 
          resolution_notes: 'Auto-resolved due to 7 days of inactivity.' 
        }).eq('id', dispute.id);

        await supabase.from('escrow').update({ 
          status: 'refunded_to_client' 
        }).eq('order_id', dispute.order_id);

        await supabase.from('orders').update({ 
          status: 'refunded' 
        }).eq('id', dispute.order_id);

        logs.push(`Auto-resolved dispute ${dispute.id}`);
      } else {
        logs.push(`Skipped dispute ${dispute.id} - no associated order`);
      }
    }
  }

  // RULE 2: 3 disputes initiated in 30 days → auto-send Level 1 F9 advisory. Dock trust score. [cite: 36]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  // Note: Complex analytical queries like finding users with 3 disputes in 30 days or 3 consecutive 1-star ratings 
  // are best handled via Supabase RPC functions for performance.
  // Here we invoke an RPC (requires creating the matching RPC in schema.sql)
  const { data: frequentDisputers, error: dispusterError } = await supabase.rpc('find_frequent_disputers', { since_date: thirtyDaysAgo });
  
  if (dispusterError) {
    console.error('Error finding frequent disputers:', dispusterError);
  }

  if (frequentDisputers && Array.isArray(frequentDisputers) && frequentDisputers.length > 0) {
    for (const user of frequentDisputers) {
      // RPC adds trust score event and returns undefined
      await supabase.rpc('add_trust_score_event', { 
        p_user_id: user.id, 
        p_event_type: 'excessive_disputes', 
        p_score_change: -15 
      });

      // Insert F9 System message with required fields from database schema
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'level_1_advisory',
        title: 'Level 1 Advisory Notice',
        message: 'Your account has initiated an unusually high number of disputes recently. Please review our marketplace guidelines.'
      });

      logs.push(`Issued Level 1 advisory to user ${user.id}`);
    }
  }

  return NextResponse.json({ success: true, actions: logs });
}