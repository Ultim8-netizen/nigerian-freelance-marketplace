// src/lib/security/fraud-detection.ts
import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

// --- Type Definitions ---

/**
 * Defines the result structure for an individual fraud check.
 */
interface FraudCheckResult {
  reason?: string;
  riskScore: number;
}

/**
 * Defines the final structure returned by the main detection function.
 */
interface FraudDetectionSummary {
  isSuspicious: boolean;
  reasons: string[];
  riskScore: number;
}

// --- Helper Functions (Private) ---

/**
 * Gets a simplified device fingerprint.
 * NOTE: In production, use a proper fingerprinting library.
 */
async function getDeviceFingerprint(): Promise<string> {
  // Placeholder implementation
  return 'device_fingerprint_placeholder';
}

/**
 * Check 1: Detects multiple accounts sharing the same device fingerprint.
 */
async function checkMultipleAccounts(
  supabase: SupabaseClient,
  userId: string
): Promise<FraudCheckResult> {
  const deviceFingerprint = await getDeviceFingerprint();
  
  const { data: devices, error } = await supabase
    .from('user_devices')
    .select('user_id')
    .eq('device_fingerprint', deviceFingerprint)
    .neq('user_id', userId); // Exclude the current user
    
  if (error) {
    console.error('Supabase error in checkMultipleAccounts:', error);
    return { riskScore: 0 };
  }

  if (devices && devices.length > 0) {
    return { 
      reason: 'Multiple accounts detected from same device', 
      riskScore: 40 
    };
  }

  return { riskScore: 0 };
}

/**
 * Check 2: Detects very new accounts (e.g., created less than 1 hour ago).
 */
async function checkRapidAccountCreation(
  supabase: SupabaseClient,
  userId: string
): Promise<FraudCheckResult> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    // Handle error or profile not found gracefully
    return { riskScore: 0 };
  }

  const accountAgeMs = Date.now() - new Date(profile.created_at).getTime();
  const hoursSinceCreation = accountAgeMs / (1000 * 60 * 60);

  if (hoursSinceCreation < 1) {
    return { 
      reason: 'Very new account (less than 1 hour old)', 
      riskScore: 20 
    };
  }

  return { riskScore: 0 };
}

/**
 * Check 3: Detects accounts that have not completed liveness verification after 7 days.
 */
async function checkMissingVerification(
  supabase: SupabaseClient,
  userId: string
): Promise<FraudCheckResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .single();

  if (!profile) return { riskScore: 0 };

  const daysSinceCreation = (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24);
  
  // Check if a verification record exists
  const { data: verification } = await supabase
    .from('liveness_verifications')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle(); // Use maybeSingle for easier null check

  if (daysSinceCreation > 7 && !verification) {
    return { 
      reason: 'No identity verification after 7 days', 
      riskScore: 30 
    };
  }

  return { riskScore: 0 };
}

/**
 * Check 4: Detects an unusually high frequency of security-related events.
 */
async function checkSuspiciousActivityFrequency(
  supabase: SupabaseClient,
  userId: string
): Promise<FraudCheckResult> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: securityLogs, error } = await supabase
    .from('security_logs')
    .select('event_type') // Select * or a small column
    .eq('user_id', userId)
    .gte('created_at', oneWeekAgo);

  if (error) {
    console.error('Supabase error in checkSuspiciousActivityFrequency:', error);
    return { riskScore: 0 };
  }

  // Threshold: more than 10 security logs in the last 7 days
  if (securityLogs && securityLogs.length > 10) {
    return { 
      reason: 'High security event frequency (last 7 days)', 
      riskScore: 25 
    };
  }

  return { riskScore: 0 };
}

// --- Main Exported Functions ---

/**
 * Orchestrates all individual fraud checks to calculate a cumulative risk score.
 */
export async function detectFraudulentAccount(userId: string): Promise<FraudDetectionSummary> {
  const supabase = await createClient(); // FIX: Added await here
  const checks: Promise<FraudCheckResult>[] = [
    checkMultipleAccounts(supabase, userId),
    checkRapidAccountCreation(supabase, userId),
    checkMissingVerification(supabase, userId),
    checkSuspiciousActivityFrequency(supabase, userId),
  ];

  // Run all checks concurrently
  const results = await Promise.all(checks);

  const reasons: string[] = [];
  let riskScore = 0;

  for (const result of results) {
    if (result.reason) {
      reasons.push(result.reason);
      riskScore += result.riskScore;
    }
  }

  // The isSuspicious threshold is 50, based on your original logic.
  return {
    isSuspicious: riskScore >= 50,
    reasons,
    riskScore,
  };
}

/**
 * Check for duplicate liveness attempts within a 24-hour period.
 */
export async function checkDuplicateLiveness(userId: string): Promise<boolean> {
  const supabase = await createClient(); // FIX: Added await here
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { count } = await supabase
    .from('liveness_verifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneDayAgo);
    
  // Allow a maximum of 3 attempts per day
  return (count || 0) > 3; 
}

/**
 * Monitor for fake review patterns, checking for high volume and uniform ratings.
 */
export async function detectFakeReviews(
  userId: string
): Promise<{ suspicious: boolean; reason?: string }> {
  const supabase = await createClient(); // FIX: Added await here
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('created_at, rating')
    .eq('reviewer_id', userId)
    .gte('created_at', oneDayAgo);

  if (error || !reviews) {
    console.error('Supabase error in detectFakeReviews:', error);
    return { suspicious: false };
  }

  // Check 1: Excessive reviews in short time (Threshold: > 10 in 24h)
  if (reviews.length > 10) {
    return {
      suspicious: true,
      reason: 'Excessive reviews in 24 hours',
    };
  }

  // Check 2: Rating manipulation (e.g., all 5-star or all 1-star)
  if (reviews.length >= 5) { // Only check if enough data points exist
    const firstRating = reviews[0].rating;
    const allSame = reviews.every((r: { rating: number }) => r.rating === firstRating); // FIX: Explicitly typed 'r'
    
    if (allSame) {
      return {
        suspicious: true,
        reason: 'Uniform rating pattern detected',
      };
    }
  }

  return { suspicious: false };
}