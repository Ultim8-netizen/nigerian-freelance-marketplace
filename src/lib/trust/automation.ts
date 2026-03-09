import { createClient } from '@/lib/supabase/server';

export async function evaluateContentTriggers(
  userId: string,
  content: { title: string; description: string; amount?: number }
): Promise<{ allowed: boolean; reason?: string; autoHold?: boolean }> {
  const supabase = await createClient();

  // 1. Fetch Prohibited Keywords from Config
  const { data: config } = await supabase
    .from('platform_config')
    .select('string_value, enabled')
    .eq('key', 'prohibited_keywords')
    .single();

  if (config?.enabled && config.string_value) {
    const keywords = config.string_value.split(',').map(k => k.trim().toLowerCase());
    const fullText = `${content.title} ${content.description}`.toLowerCase();
    
    const containsProhibited = keywords.some(keyword => fullText.includes(keyword));
    
    if (containsProhibited) {
      // Log critical flag
      await supabase.from('security_logs').insert({
        user_id: userId,
        event_type: 'prohibited_keyword',
        description: 'Attempted to post listing with prohibited keywords',
        severity: 'high'
      });
      return { allowed: false, reason: 'Listing contains prohibited keywords and violates safety policies.' };
    }
  }

  // 2. High Value Hold for New Accounts (> ₦100,000 within first 7 days)
  if (content.amount && content.amount > 100000) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('created_at')
      .eq('id', userId)
      .single();

    // FIXED: Added null check for profile.created_at before passing to new Date()
    if (profile && profile.created_at) {
      const daysSinceCreation = (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation <= 7) {
        // Create an automated flag for admin review
        await supabase.from('security_logs').insert({
          user_id: userId,
          event_type: 'high_value_new_account',
          description: `New account attempting to post listing of ₦${content.amount}`,
          severity: 'medium'
        });
        return { allowed: true, autoHold: true };
      }
    }
  }

  return { allowed: true, autoHold: false };
}