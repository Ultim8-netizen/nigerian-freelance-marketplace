import { createClient } from '@/lib/supabase/server';

export interface TrustGateResponse {
  allowed: boolean;
  reason?: string;
  restrictionType?: 'soft_lock' | 'verification_required' | 'amount_capped';
  capAmount?: number;
}

// ─── Canonical trust tier thresholds ─────────────────────────────────────────
// These must match the DB trigger `update_profile_trust_level` and
// the TRUST_LEVELS definitions in src/lib/trust/trust-score.ts.
//
//   NEW      :  0 – 24   (score < 25)
//   VERIFIED : 25 – 39   (score >= 25 && < 40)
//   TRUSTED  : 40 – 69   (score >= 40 && < 70)
//   TOP_RATED: 70 – 89   (score >= 70 && < 90)
//   ELITE    : 90+        (score >= 90)
//
const TIER = {
  VERIFIED_MIN:  25,
  TRUSTED_MIN:   40,
  TOP_RATED_MIN: 70,
  ELITE_MIN:     90,
} as const;

const TRUSTED_LISTING_CAP = 50_000; // ₦50,000

// ─────────────────────────────────────────────────────────────────────────────

export async function evaluateTrustGate(
  userId: string,
  action: 'post_listing' | 'request_withdrawal',
  amount?: number
): Promise<TrustGateResponse> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('trust_score')
    .eq('id', userId)
    .single();

  const score = profile?.trust_score ?? 0;

  // ── NEW tier (0 – 24): Soft-locked ────────────────────────────────────────
  if (score < TIER.VERIFIED_MIN) {
    return {
      allowed: false,
      reason: 'Your account is currently restricted due to a low trust score.',
      restrictionType: 'soft_lock',
    };
  }

  // ── VERIFIED tier (25 – 39): Cannot post listings ─────────────────────────
  if (score < TIER.TRUSTED_MIN) {
    if (action === 'post_listing') {
      return {
        allowed: false,
        reason: 'You must increase your trust score or verify your identity to post listings.',
        restrictionType: 'verification_required',
      };
    }
  }

  // ── TRUSTED tier (40 – 69): Listings capped at ₦50,000 ───────────────────
  // Note: The 48-hour withdrawal delay for this tier is enforced at the
  // withdrawal execution layer (freelancer/earnings/page.tsx `initiateWithdrawal`),
  // not here.
  if (score < TIER.TOP_RATED_MIN) {
    if (action === 'post_listing' && amount !== undefined && amount > TRUSTED_LISTING_CAP) {
      return {
        allowed: false,
        reason: `Listings are currently capped at ₦${TRUSTED_LISTING_CAP.toLocaleString()} for your trust tier.`,
        restrictionType: 'amount_capped',
        capAmount: TRUSTED_LISTING_CAP,
      };
    }
  }

  // ── TOP_RATED (70 – 89) and ELITE (90+): Full access ─────────────────────
  return { allowed: true };
}