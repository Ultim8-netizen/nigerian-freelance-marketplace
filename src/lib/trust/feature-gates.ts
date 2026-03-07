import { createClient } from '@/lib/supabase/server';

export interface TrustGateResponse {
  allowed: boolean;
  reason?: string;
  restrictionType?: 'soft_lock' | 'verification_required' | 'amount_capped';
  capAmount?: number;
}

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

  // Below 20: Soft-locked
  if (score < 20) {
    return {
      allowed: false,
      reason: 'Your account is currently restricted due to a low trust score.',
      restrictionType: 'soft_lock'
    };
  }

  // 20 - 39: Cannot post listings, prompted to verify
  if (score >= 20 && score < 40) {
    if (action === 'post_listing') {
      return {
        allowed: false,
        reason: 'You must increase your trust score or verify your identity to post listings.',
        restrictionType: 'verification_required'
      };
    }
  }

  // 40 - 59: Cannot post above 50k, 48h withdrawal delay
  if (score >= 40 && score < 60) {
    if (action === 'post_listing' && amount && amount > 50000) {
      return {
        allowed: false,
        reason: 'Listings are currently capped at ₦50,000 for your trust tier.',
        restrictionType: 'amount_capped',
        capAmount: 50000
      };
    }
    // Note: The 48hr withdrawal delay logic should be applied at the withdrawal execution layer
  }

  // 60 - 100: Full Access
  return { allowed: true };
}