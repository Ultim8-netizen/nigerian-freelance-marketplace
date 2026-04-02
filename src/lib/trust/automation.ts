// src/lib/trust/automation.ts
// FIX: content.amount > 100000 and daysSinceCreation <= 7 were hardcoded.
//      Both values are now read from platform_config via createAdminClient()
//      (service role) which is required for admin-only RLS on platform_config.
// FIX: prohibited_keywords config was also fetched with createClient() — a
//      user-scoped client that silently returns no rows on admin-only RLS tables.
//      All platform_config reads in this module now use the adminClient so the
//      keyword filter actually executes.

import { createAdminClient }                    from '@/lib/supabase/admin';
import { getPlatformConfigs, CONFIG_KEYS }       from '@/lib/platform-config';

export async function evaluateContentTriggers(
  userId:  string,
  content: { title: string; description: string; amount?: number }
): Promise<{ allowed: boolean; reason?: string; autoHold?: boolean }> {
  // createAdminClient() (service role) is required for all platform_config reads
  // in this function — platform_config has admin-only RLS and silently returns
  // zero rows when accessed with a regular user-scoped createClient().
  const adminClient = createAdminClient();

  // ── Fetch numeric thresholds in a single query ────────────────────────────
  const config = await getPlatformConfigs(adminClient, [
    CONFIG_KEYS.HIGH_VALUE_LISTING_THRESHOLD,
    CONFIG_KEYS.NEW_ACCOUNT_HOLD_DAYS,
  ]);

  const highValueThreshold = config[CONFIG_KEYS.HIGH_VALUE_LISTING_THRESHOLD];
  const newAccountHoldDays = config[CONFIG_KEYS.NEW_ACCOUNT_HOLD_DAYS];

  // ── 1. Prohibited keywords ────────────────────────────────────────────────
  // string_value is a text column on platform_config used for non-numeric
  // config; it lives outside the numeric getPlatformConfigs helper so it is
  // fetched with a direct select using the same adminClient.
  const { data: keywordsConfig } = await adminClient
    .from('platform_config')
    .select('string_value, enabled')
    .eq('key', 'prohibited_keywords')
    .single();

  if (keywordsConfig?.enabled && keywordsConfig.string_value) {
    const keywords = keywordsConfig.string_value
      .split(',')
      .map((k: string) => k.trim().toLowerCase());
    const fullText = `${content.title} ${content.description}`.toLowerCase();

    const containsProhibited = keywords.some((keyword: string) =>
      fullText.includes(keyword)
    );

    if (containsProhibited) {
      await adminClient.from('security_logs').insert({
        user_id:     userId,
        event_type:  'prohibited_keyword',
        description: 'Attempted to post listing with prohibited keywords',
        severity:    'high',
      });
      return {
        allowed: false,
        reason:  'Listing contains prohibited keywords and violates safety policies.',
      };
    }
  }

  // ── 2. High-value listing hold for new accounts ───────────────────────────
  // Threshold and window are read from platform_config above; hardcoded values
  // (100000 / 7) are never referenced — only the defaults in DEFAULTS serve as
  // cold-start fallbacks if the config rows are absent or disabled.
  if (content.amount && content.amount > highValueThreshold) {
    const { data: profile } = await adminClient
      .from('profiles')
      .select('created_at')
      .eq('id', userId)
      .single();

    if (profile && profile.created_at) {
      const daysSinceCreation =
        (Date.now() - new Date(profile.created_at).getTime()) /
        (1000 * 60 * 60 * 24);

      if (daysSinceCreation <= newAccountHoldDays) {
        await adminClient.from('security_logs').insert({
          user_id:     userId,
          event_type:  'high_value_new_account',
          description: `New account attempting to post listing of ₦${content.amount}`,
          severity:    'medium',
        });
        return { allowed: true, autoHold: true };
      }
    }
  }

  return { allowed: true, autoHold: false };
}