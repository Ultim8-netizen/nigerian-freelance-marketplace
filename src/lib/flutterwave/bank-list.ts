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
 * match Flutterwave's own naming (e.g. "Guaranty Trust Bank"). This does a
 * loose, bidirectional, word-stripped match against the live list.
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
  const normalize = (s: string) => s.toLowerCase().replace(/\bbank\b/g, '').trim();
  const normalized = normalize(bankName);

  const exact = banks.find((b) => normalize(b.name) === normalized);
  if (exact) return exact.code;

  const candidates = banks.filter((b) => {
    const n = normalize(b.name);
    return n.includes(normalized) || normalized.includes(n);
  });

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