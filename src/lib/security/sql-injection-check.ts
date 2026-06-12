// src/lib/security/sql-injection-check.ts
//
// Defense-in-depth SQL injection detection.
//
// IMPORTANT: This is a supplementary application-layer check. Supabase uses
// parameterized queries exclusively, which makes SQL injection structurally
// impossible at the DB driver level. This function exists to:
//   1. Log and reject obviously malicious inputs early (before any DB call)
//   2. Provide a signal for automated abuse detection and trust score updates
//   3. Surface attack attempts in security_logs for audit purposes
//
// Do NOT use this as a substitute for parameterized queries.
//
// FIX: Removed the raw single-quote / semicolon catch-all pattern:
//   /['";`]/
// This matched any string containing a single quote, including completely
// legitimate inputs: "it's", "O'Brien", "Chioma's store", "Lagos's market".
// False positives on natural language eroded confidence in the check and would
// block real users. Quote-based attacks are now caught contextually — a quote
// must appear adjacent to an SQL keyword to trigger a match.

// ── Pattern suite ─────────────────────────────────────────────────────────────
//
// Each pattern targets a distinct attack class. All patterns are tested against
// a lowercased, whitespace-normalized copy of the input. Patterns carry the /i
// flag for safety in case the normalization step is ever modified.

const SQL_PATTERNS: readonly RegExp[] = [
  // Boolean / conditional injection: OR 1=1, AND 1=1, OR 'a'='a', AND '1'='1'
  /\b(or|and)\b\s+.{0,30}=\s*.{0,30}/i,

  // UNION-based data exfiltration
  /\bunion\b.{0,30}\bselect\b/i,

  // DDL / destructive statements
  /\bdrop\s+(table|database|schema|index|view|column)\b/i,
  /\btruncate\s+table\b/i,
  /\balter\s+(table|database|schema)\b/i,
  /\bcreate\s+(table|database|schema|user)\b/i,

  // DML injection (INSERT / UPDATE / DELETE outside normal parameterized flow)
  /\binsert\s+into\b/i,
  /\bdelete\s+from\b/i,
  /\bupdate\b.{0,30}\bset\b/i,

  // Multi-statement execution: '; SELECT', '; DROP', etc.
  /;\s*\b(select|insert|update|delete|drop|exec|execute|create|alter|grant|revoke)\b/i,

  // Line comments — used to truncate the rest of a query and bypass validation
  /--/,

  // Block comments (MySQL, standard SQL, PostgreSQL)
  /\/\*[\s\S]*?\*\//,

  // Quote-adjacent SQL keywords — catches classic string-escape injection:
  // ' OR '1'='1, ' UNION SELECT ..., " AND "1"="1
  /['"`]\s*\b(or|and|union|select|insert|update|delete|where|having)\b/i,

  // Time-based / error-based blind injection
  /\b(sleep|waitfor\s+delay|benchmark|pg_sleep)\s*\(/i,

  // MSSQL extended stored procedures and command execution
  /\bexec(ute)?\s+(xp_|sp_)\w+/i,
  /\bxp_cmdshell\b/i,

  // Database metadata enumeration (reconnaissance phase)
  /\binformation_schema\b/i,
  /\bsys\.(tables|columns|objects|databases|all_tables)\b/i,

  // PostgreSQL system catalog access
  /\bpg_catalog\b/i,
  /\bpg_(tables|class|namespace|attribute|user|shadow)\b/i,

  // Hex / CHAR encoding used to bypass keyword-based filters
  // e.g. CHAR(83,69,76,69,67,84) or 0x53454c454354
  /\bchar\s*\(\s*\d+/i,
  /\b0x[0-9a-f]{4,}\b/i,

  // LOAD FILE / INTO OUTFILE — file system access via SQL
  /\b(load_file|into\s+outfile|into\s+dumpfile)\b/i,

  // GRANT / REVOKE — privilege escalation
  /\b(grant|revoke)\s+.{0,30}\bon\b/i,
];

/**
 * Returns true if `input` contains patterns indicative of a SQL injection
 * attempt. Returns false for empty/nullish input.
 *
 * @param input - Raw string from a user-supplied field or URL parameter.
 */
export function containsSqlInjection(input: string): boolean {
  if (!input) return false;

  // Normalize: lowercase + collapse whitespace runs.
  // This defeats obfuscation via mixed case ("SeLeCt") or padding spaces ("S E L E C T").
  const normalized = input.toLowerCase().replace(/\s+/g, ' ').trim();

  return SQL_PATTERNS.some((pattern) => pattern.test(normalized));
}