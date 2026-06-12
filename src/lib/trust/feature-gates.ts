// src/lib/trust/feature-gates.ts

import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TRUST_LEVELS }      from '@/lib/trust/trust-score';

// TRUST_LEVELS is now the single source of truth for tier thresholds —
// no local TIER constants. Any threshold change in trust-score.ts is
// automatically reflected here.

export interface TrustGateResponse {
  allowed:          boolean;
  reason?:          string;
  restrictionType?: 'soft_lock' | 'verification_required' | 'amount_capped';
  capAmount?:       number;
}

export async function evaluateTrustGate(
  userId: string,
  action: 'post_listing' | 'request_withdrawal',
  amount?: number
): Promise<TrustGateResponse> {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  // Fetch profile score and both config values in parallel — no sequential awaits
  const [profileResult, listingCapResult, withdrawalMinResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('trust_score')
      .eq('id', userId)
      .single(),
    adminClient
      .from('platform_config')
      .select('value, enabled')
      .eq('key', 'max_listing_unverified')
      .single(),
    adminClient
      .from('platform_config')
      .select('value, enabled')
      .eq('key', 'withdrawal_min_score')
      .single(),
  ]);

  const score = profileResult.data?.trust_score ?? 0;

  // Fall back to DB defaults if config row is absent or disabled
  const listingCap: number =
    listingCapResult.data?.enabled
      ? (listingCapResult.data.value ?? 50_000)
      : 50_000;

  const withdrawalMinScore: number =
    withdrawalMinResult.data?.enabled
      ? (withdrawalMinResult.data.value ?? 20)
      : 20;

  // ── Withdrawals ───────────────────────────────────────────────────────────
  // Uses platform_config.withdrawal_min_score (currently 20) — intentionally
  // lower than the VERIFIED tier threshold (25) so users can still withdraw
  // earned funds even before fully clearing the VERIFIED gate.
  // The 48-hour withdrawal delay for TRUSTED tier is enforced at the execution
  // layer (freelancer/earnings/page.tsx `initiateWithdrawal`), not here.
  if (action === 'request_withdrawal') {
    if (score < withdrawalMinScore) {
      return {
        allowed:         false,
        reason:          `Your trust score must be at least ${withdrawalMinScore} to withdraw funds.`,
        restrictionType: 'soft_lock',
      };
    }
    return { allowed: true };
  }

  // ── post_listing: full tier ladder ────────────────────────────────────────

  // NEW tier (0 – 24): fully soft-locked
  if (score < TRUST_LEVELS.VERIFIED.minScore) {
    return {
      allowed:         false,
      reason:          'Your account is currently restricted due to a low trust score.',
      restrictionType: 'soft_lock',
    };
  }

  // VERIFIED tier (25 – 39): identity confirmed but not yet active enough to post
  if (score < TRUST_LEVELS.TRUSTED.minScore) {
    return {
      allowed:         false,
      reason:          'You must increase your trust score or verify your identity to post listings.',
      restrictionType: 'verification_required',
    };
  }

  // TRUSTED tier (40 – 69): can post, but capped at platform_config.max_listing_unverified
  if (score < TRUST_LEVELS.TOP_RATED.minScore) {
    if (amount !== undefined && amount > listingCap) {
      return {
        allowed:         false,
        reason:          `Listings are currently capped at ₦${listingCap.toLocaleString()} for your trust tier.`,
        restrictionType: 'amount_capped',
        capAmount:       listingCap,
      };
    }
  }

  // TOP_RATED (70 – 89) and ELITE (90+): full access, no cap
  return { allowed: true };
}