// src/lib/platform-config.ts
// Batch-fetches numeric threshold values from platform_config.
//
// IMPORTANT — RLS: platform_config has admin-only access (no public SELECT).
// The supabase client passed to getPlatformConfigs MUST be either:
//   - createAdminClient()   (service role — use in server components / actions)
//   - createServiceClient() (service role — use in cron / API routes)
// Passing a regular createClient() will return no rows silently.
//
// Disabled rows (enabled = false) fall back to the hardcoded default so that
// an admin can toggle off a rule without the code throwing.

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Canonical keys ──────────────────────────────────────────────────────────
// These must match the keys seeded by migration_platform_config_thresholds.sql

export const CONFIG_KEYS = {
  DISPUTE_AUTO_RESOLVE_DAYS:          'dispute_auto_resolve_days',
  FREQUENT_DISPUTER_WINDOW_DAYS:      'frequent_disputer_window_days',
  UNLINKED_TX_WINDOW_HOURS:           'unlinked_tx_window_hours',
  WALLET_FUND_HOLD_HOURS:             'wallet_fund_hold_hours',
  BANK_UPDATE_HOLD_HOURS:             'bank_update_hold_hours',
  CONSECUTIVE_LOW_RATING_THRESHOLD:   'consecutive_low_rating_threshold',
  POSTING_SUSPENSION_HOURS:           'posting_suspension_hours',
  HIGH_VALUE_LISTING_THRESHOLD:       'high_value_listing_threshold',
  NEW_ACCOUNT_HOLD_DAYS:              'new_account_hold_days',
  /**
   * ₦ amount above which withdrawals are automatically held for manual
   * admin review. 0 = disabled (no threshold gate).
   * Set via the admin finance panel → Withdrawal Gate banner.
   */
  WITHDRAWAL_GATE_THRESHOLD:          'withdrawal_gate_threshold',
} as const;

export type ConfigKey = typeof CONFIG_KEYS[keyof typeof CONFIG_KEYS];

// ── Hardcoded fallback defaults ─────────────────────────────────────────────
// Used when a key is absent, disabled, or returns null.
// Mirrors the values seeded by the migration so cold starts behave correctly
// even before the migration runs.

const DEFAULTS: Record<ConfigKey, number> = {
  [CONFIG_KEYS.DISPUTE_AUTO_RESOLVE_DAYS]:        7,
  [CONFIG_KEYS.FREQUENT_DISPUTER_WINDOW_DAYS]:    30,
  [CONFIG_KEYS.UNLINKED_TX_WINDOW_HOURS]:         24,
  [CONFIG_KEYS.WALLET_FUND_HOLD_HOURS]:           2,
  [CONFIG_KEYS.BANK_UPDATE_HOLD_HOURS]:           48,
  [CONFIG_KEYS.CONSECUTIVE_LOW_RATING_THRESHOLD]: 3,
  [CONFIG_KEYS.POSTING_SUSPENSION_HOURS]:         72,
  [CONFIG_KEYS.HIGH_VALUE_LISTING_THRESHOLD]:     100000,
  [CONFIG_KEYS.NEW_ACCOUNT_HOLD_DAYS]:            7,
  [CONFIG_KEYS.WITHDRAWAL_GATE_THRESHOLD]:        0,   // 0 = gate disabled
};

/**
 * Fetch multiple platform_config values in a single query.
 *
 * Returns a Record<key, number> using the hardcoded default for any key
 * that is absent, disabled (enabled = false), or has value = null.
 *
 * @param supabase  Must be a service-role client (admin or service client).
 * @param keys      Array of CONFIG_KEYS values to fetch.
 */
export async function getPlatformConfigs(
  supabase: SupabaseClient,
  keys:     ConfigKey[]
): Promise<Record<ConfigKey, number>> {
  // Initialise result with defaults — any missing key stays as its default
  const result = Object.fromEntries(
    keys.map((k) => [k, DEFAULTS[k]])
  ) as Record<ConfigKey, number>;

  if (keys.length === 0) return result;

  try {
    const { data, error } = await supabase
      .from('platform_config')
      .select('key, value, enabled')
      .in('key', keys);

    if (error) {
      console.error('[platform-config] fetch error — using defaults:', error);
      return result;
    }

    for (const row of data ?? []) {
      const key = row.key as ConfigKey;
      // Skip if not one of the requested keys, disabled, or value is null
      if (!(key in result))      continue;
      if (row.enabled === false) continue;
      if (row.value   === null)  continue;

      result[key] = row.value;
    }
  } catch (err) {
    console.error('[platform-config] unexpected error — using defaults:', err);
  }

  return result;
}