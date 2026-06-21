// src/lib/flutterwave/bank-list.ts
//
// FIX (found via live testing + user report): the original hardcoded
// BANK_CODES map in execute/route.ts had 14 entries. Nigeria's NIP-enabled
// institution registry — commercial banks, microfinance banks, payment
// service banks (9PSB, HopePSB, MoMo PSB, SmartCash PSB), and dozens of
// fintechs — runs into the hundreds. A hardcoded list of that size was
// never going to represent real users' actual banks, and as already
// proven twice over via scripts/verify-bank-codes.ts (Opay and Moniepoint
// both had wrong codes), any hardcoded snapshot drifts out of sync with
// Flutterwave's live list with no warning when it does.
//
// This replaces the static map entirely. Bank codes are now resolved live
// against Flutterwave's actual GET /v3/banks/NG response — the same data
// the verify script already pulled to diff against a map that no longer
// exists. There is no longer a finite list to fall out of date.
//
// CACHING: simple in-memory module-level cache with a TTL. Bank lists
// change rarely — this avoids hitting Flutterwave's API on every page
// load or withdrawal execution, while self-healing within a few hours of
// any real change. Resets on a serverless cold start; that's an
// acceptable tradeoff given how rarely this data changes and how low-
// stakes a brief cache miss is (one extra API call, not a correctness
// issue).
//
// FIX (matching — ported from the same bug already fixed in
// scripts/verify-bank-codes.ts): the original fallback matcher stripped
// the literal substring "bank" (not word-bounded) and did a loose
// includes() check both directions. That breaks abbreviations: "GTBank"
// normalized to "gt", which happened to appear inside "Gti Microfinance
// Bank"; "UBA" normalized to "uba", which happened to appear inside
// "Bubayero Microfinance Bank"; "FCMB" normalized to "fcmb", which matched
// "Fcmb Microfinance Bank" instead of "First City Monument Bank". None of
// these legacy shorthand names are an actual substring of their real
// bank's full registered name on Flutterwave's live list, so the correct
// entry was never even considered as a candidate.
//
// The matcher now: (1) normalizes names by stripping "bank"/"plc" as whole
// words via regex (not raw substring deletion), (2) has an explicit
// ALIASES map for legacy shorthand names that don't substring-match their
// real full name (GTBank, UBA, FCMB), (3) tries an exact normalized-name
// match first, (4) falls back to a word-boundary substring match only if
// no exact hit exists, and (5) prefers non-microfinance candidates over
// microfinance ones when both are present for the same search term.

import 'server-only';
import { FlutterwaveServerService } from './server-service';

export interface NigerianBank {
  code: string;
  name: string;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

let cachedBanks: NigerianBank[] | null = null;
let cachedAt = 0;

/**
 * Returns the live, alphabetized list of Nigerian banks/microfinance
 * banks/PSBs Flutterwave supports for transfers, from cache if fresh.
 * Used to populate the bank dropdown in earnings/page.tsx with the actual
 * full set, instead of a hand-picked subset.
 */
export async function getNigerianBankList(): Promise<NigerianBank[]> {
  const now = Date.now();

  if (cachedBanks && now - cachedAt < CACHE_TTL_MS) {
    return cachedBanks;
  }

  const banks = await FlutterwaveServerService.getNigerianBanks();
  const sorted = [...banks].sort((a, b) => a.name.localeCompare(b.name));

  cachedBanks = sorted;
  cachedAt = now;

  return sorted;
}

// Normalizes a bank name for comparison: lowercase, strip "bank"/"plc" as
// whole words (not raw substring removal — see file header for why that
// broke abbreviations), strip punctuation, collapse whitespace.
function normalizeBankName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bplc\b/g, '')
    .replace(/\bbank\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isMicrofinance(bankName: string): boolean {
  return /microfinance|\bmfb\b/i.test(bankName);
}

// Explicit aliases for legacy shorthand names (from the old hardcoded
// BANK_CODES map) whose abbreviation isn't a reliable substring of the
// bank's full registered name on Flutterwave's live list — e.g. "gt" is
// not a substring of "guaranty trust". Only relevant to the fallback path
// below; every withdrawal created after bank_code existed bypasses this
// entirely and uses the stored code directly.
const ALIASES: Record<string, string> = {
  GTBank: 'guaranty trust',
  UBA: 'united for africa',
  FCMB: 'first city monument',
};

function findBankCandidates(searchName: string, liveBanks: NigerianBank[]): NigerianBank[] {
  const normalizedSearchName = normalizeBankName(searchName);
  const searchTerm = ALIASES[searchName] ?? normalizedSearchName;

  // Pass 1: exact normalized-name match
  let candidates = liveBanks.filter((b) => normalizeBankName(b.name) === searchTerm);

  // Pass 2: word-boundary substring match, only if pass 1 found nothing
  if (candidates.length === 0) {
    const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(searchTerm)}\\b`);
    candidates = liveBanks.filter((b) => wordBoundaryRegex.test(normalizeBankName(b.name)));
  }

  // Prefer non-microfinance candidates when both exist for the same search
  // term (e.g. don't let a "X Microfinance Bank" entry win over plain "X").
  if (candidates.length > 1) {
    const nonMfb = candidates.filter((c) => !isMicrofinance(c.name));
    if (nonMfb.length > 0) candidates = nonMfb;
  }

  return candidates;
}

/**
 * Resolve a bank code for a withdrawal.
 *
 * Normal path: bankCode is already known (every withdrawal created after
 * this fix submits the code directly, since the dropdown now carries
 * Flutterwave's own code alongside the bank name — see earnings/page.tsx).
 *
 * Fallback path: for any withdrawal row created BEFORE the bank_code
 * column existed, only bank_name is available, and it may be a shorthand
 * the old hardcoded dropdown used (e.g. "GTBank") that doesn't exactly
 * match Flutterwave's own naming (e.g. "Guaranty Trust Bank"). This does
 * an exact-match-first, alias-aware, word-boundary fallback match against
 * the live list (see findBankCandidates above).
 *
 * Throws rather than guessing on ambiguity or a missing match — a wrong
 * bank code on a real payout is a money-movement risk, not a cosmetic
 * one, so callers must treat this as a hard failure to surface, not a
 * default to paper over.
 */
export async function resolveBankCode(
  bankName: string,
  bankCode?: string | null,
): Promise<string> {
  if (bankCode) return bankCode;

  const banks = await getNigerianBankList();
  const candidates = findBankCandidates(bankName, banks);

  if (candidates.length === 1) return candidates[0].code;

  if (candidates.length > 1) {
    throw new Error(
      `Ambiguous bank name "${bankName}" matched multiple Flutterwave entries: ` +
      candidates.map((c) => `"${c.name}" (${c.code})`).join(', ') +
      '. Refusing to guess on a payout.',
    );
  }

  throw new Error(
    `No Flutterwave bank match found for "${bankName}". Cannot resolve a bank code for this withdrawal.`,
  );
}