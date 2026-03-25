// src/lib/security/fraud-detection.ts
// UPDATED: checkMultipleAccounts (device fingerprint placeholder) removed — device
//          fingerprinting was scrapped. Replaced with checkSharedIpAddress, which
//          uses the admin client (service role) to cross-reference ip_address across
//          all user_devices rows. user_devices RLS is own-user-only, so cross-user
//          reads require service role.
// FIXED:   detectFraudulentAccount now accepts a SupabaseClient parameter instead of
//          creating createClient() internally. The internal createClient() has no
//          active session at registration time (email verification pending), which
//          caused all profile queries to return null, silently short-circuiting every
//          check.
// FIXED:   Null guards added to profile.created_at reads in checkRapidAccountCreation
//          and checkMissingVerification. profiles.created_at is string | null in the
//          schema — deriving a Date from null produced NaN, making both time checks
//          always return 0 risk.
// FIXED:   security_logs has no user INSERT policy. All writes to security_logs must
//          use the admin client. Inserts are the caller's responsibility — these
//          functions remain query-only and return structured results.

import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Type Definitions ─────────────────────────────────────────────────────────

interface FraudCheckResult {
  reason?:   string;
  riskScore: number;
}

export interface FraudDetectionSummary {
  isSuspicious: boolean;
  reasons:      string[];
  riskScore:    number;
}

// ─── Individual Checks (internal) ────────────────────────────────────────────

/**
 * Check 1: Detects very new accounts (created less than 1 hour ago).
 * Most meaningful in the cron context where many accounts are scanned.
 * At registration time, this always fires (riskScore: 20) but does not
 * alone breach the 50-point suspension threshold.
 */
async function checkRapidAccountCreation(
  supabase: SupabaseClient,
  userId:   string
): Promise<FraudCheckResult> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .single();

  if (error || !profile || !profile.created_at) return { riskScore: 0 };

  const hoursSinceCreation =
    (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60);

  if (hoursSinceCreation < 1) {
    return { reason: 'Very new account (less than 1 hour old)', riskScore: 20 };
  }

  return { riskScore: 0 };
}

/**
 * Check 2: Detects accounts with no liveness verification after 7 days.
 * Never fires at registration (account is 0 days old).
 * Designed for cron scanning of established accounts.
 */
async function checkMissingVerification(
  supabase: SupabaseClient,
  userId:   string
): Promise<FraudCheckResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .single();

  if (!profile || !profile.created_at) return { riskScore: 0 };

  const daysSinceCreation =
    (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24);

  const { data: verification } = await supabase
    .from('liveness_verifications')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (daysSinceCreation > 7 && !verification) {
    return { reason: 'No identity verification after 7 days', riskScore: 30 };
  }

  return { riskScore: 0 };
}

/**
 * Check 3: Detects unusually high security event frequency.
 * Threshold: more than 10 security_logs entries in the last 7 days.
 * Requires the caller's client to have SELECT on security_logs (own-user RLS satisfied
 * when the client is authenticated as userId, or via admin client).
 */
async function checkSuspiciousActivityFrequency(
  supabase: SupabaseClient,
  userId:   string
): Promise<FraudCheckResult> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: securityLogs, error } = await supabase
    .from('security_logs')
    .select('event_type')
    .eq('user_id', userId)
    .gte('created_at', oneWeekAgo);

  if (error) {
    console.error('[fraud-detection] checkSuspiciousActivityFrequency error:', error);
    return { riskScore: 0 };
  }

  if (securityLogs && securityLogs.length > 10) {
    return { reason: 'High security event frequency (last 7 days)', riskScore: 25 };
  }

  return { riskScore: 0 };
}

// ─── Shared IP Check (exported — admin client required) ───────────────────────

/**
 * Checks whether the given IP address is already registered in user_devices
 * under a different user_id.
 *
 * REQUIRES admin client: user_devices RLS restricts reads to the authenticated
 * user's own rows. Cross-user lookup is impossible with a regular session client.
 *
 * Returns an array of conflicting user IDs (empty if none found).
 */
export async function checkSharedIpAddress(
  adminClient: SupabaseClient,
  userId:      string,
  ip:          string
): Promise<string[]> {
  if (!ip || ip === 'unknown') return [];

  try {
    const { data, error } = await adminClient
      .from('user_devices')
      .select('user_id')
      .eq('ip_address', ip as unknown)
      .neq('user_id', userId)
      .limit(10);

    if (error) {
      console.error('[fraud-detection] checkSharedIpAddress error:', error);
      return [];
    }

    return (data ?? [])
      .map((d) => d.user_id)
      .filter((id): id is string => id !== null);
  } catch (err) {
    console.error('[fraud-detection] checkSharedIpAddress unexpected error:', err);
    return [];
  }
}

// ─── Main Detection Function ──────────────────────────────────────────────────

/**
 * Orchestrates all individual fraud checks against an existing user.
 *
 * @param supabase  Server-side Supabase client. Must be authenticated as userId
 *                  OR the admin client — the checks query profiles, liveness_verifications,
 *                  and security_logs, all of which have own-user RLS policies.
 *                  Passing an unauthenticated regular client causes all profile queries
 *                  to return null, silently zeroing every check.
 * @param userId    The user being evaluated.
 *
 * Shared-IP detection is NOT included here — it requires the IP from the request
 * and the admin client. Call checkSharedIpAddress() separately in the route handler.
 */
export async function detectFraudulentAccount(
  supabase: SupabaseClient,
  userId:   string
): Promise<FraudDetectionSummary> {
  const results = await Promise.all([
    checkRapidAccountCreation(supabase, userId),
    checkMissingVerification(supabase, userId),
    checkSuspiciousActivityFrequency(supabase, userId),
  ]);

  const reasons:   string[] = [];
  let   riskScore: number   = 0;

  for (const result of results) {
    if (result.reason) {
      reasons.push(result.reason);
      riskScore += result.riskScore;
    }
  }

  return {
    isSuspicious: riskScore >= 50,
    reasons,
    riskScore,
  };
}

// ─── Liveness duplicate check ─────────────────────────────────────────────────

/**
 * Returns true if the user has made more than 3 liveness verification attempts
 * in the last 24 hours. Designed to be called from the liveness verification route.
 */
export async function checkDuplicateLiveness(
  supabase: SupabaseClient,
  userId:   string
): Promise<boolean> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count } = await supabase
    .from('liveness_verifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneDayAgo);

  return (count ?? 0) > 3;
}

// ─── Fake review detection ────────────────────────────────────────────────────

/**
 * Detects fake review patterns: excessive volume (>10 in 24h) or
 * uniform rating manipulation (all same rating across ≥5 reviews).
 */
export async function detectFakeReviews(
  supabase: SupabaseClient,
  userId:   string
): Promise<{ suspicious: boolean; reason?: string }> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('created_at, rating')
    .eq('reviewer_id', userId)
    .gte('created_at', oneDayAgo);

  if (error || !reviews) {
    console.error('[fraud-detection] detectFakeReviews error:', error);
    return { suspicious: false };
  }

  if (reviews.length > 10) {
    return { suspicious: true, reason: 'Excessive reviews in 24 hours' };
  }

  if (reviews.length >= 5) {
    const firstRating = reviews[0].rating;
    const allSame     = reviews.every((r: { rating: number }) => r.rating === firstRating);
    if (allSame) {
      return { suspicious: true, reason: 'Uniform rating pattern detected' };
    }
  }

  return { suspicious: false };
}