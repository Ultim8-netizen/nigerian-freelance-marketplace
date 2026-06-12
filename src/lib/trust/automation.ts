// src/lib/trust/automation.ts

import { createAdminClient }               from '@/lib/supabase/admin';
import { getPlatformConfigs, CONFIG_KEYS }  from '@/lib/platform-config';

export async function evaluateContentTriggers(
  userId:  string,
  content: { title: string; description: string; amount?: number }
): Promise<{ allowed: boolean; reason?: string; autoHold?: boolean }> {
  // createAdminClient() (service role) is required for all platform_config reads —
  // platform_config has admin-only RLS and silently returns zero rows with a
  // regular user-scoped createClient().
  const adminClient = createAdminClient();

  const config = await getPlatformConfigs(adminClient, [
    CONFIG_KEYS.HIGH_VALUE_LISTING_THRESHOLD,
    CONFIG_KEYS.NEW_ACCOUNT_HOLD_DAYS,
  ]);

  // ?? fallbacks: if the config row is absent, disabled, or returns undefined,
  // fall back to the DB-level defaults rather than producing NaN comparisons.
  const highValueThreshold: number = config[CONFIG_KEYS.HIGH_VALUE_LISTING_THRESHOLD] ?? 100_000;
  const newAccountHoldDays: number = config[CONFIG_KEYS.NEW_ACCOUNT_HOLD_DAYS] ?? 7;

  // ── 1. Prohibited keywords ────────────────────────────────────────────────
  // string_value is NULL in platform_config today — the block safely no-ops.
  // When keywords are added via the admin portal this path activates automatically.
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