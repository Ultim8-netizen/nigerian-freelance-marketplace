// src/lib/security/sql-injection-check.ts
/**
 * Checks if a string contains common patterns indicative of a SQL injection attempt.
 * NOTE: This is a preventative check and should always be used alongside parameterized queries.
 * @param input The string input (e.g., from a user form field or query parameter).
 * @returns true if potential SQL injection patterns are found, false otherwise.
 */
export function containsSqlInjection(input: string): boolean {
  if (!input) return false;

  const sqlPatterns = [
    // Boolean/Conditional attacks (OR/AND with comparison)
    /(\bor\b|\band\b).*?=/i,
    // UNION SELECT attacks
    /union.*select/i,
    // Database structure modification
    /drop\s+table/i,
    // Line comments (used to skip the rest of the query)
    /--/,
    // Multi-statement execution
    /;.*select/i,
    // Simple quotes used in conjunction with OR/AND conditions
    /'.*or.*'/i,
    // Simple quote used to break out of string context
    /['";`]/,
    // Time-based/error-based injection functions (MySQL/MSSQL examples)
    /(sleep|waitfor\s+delay|benchmark)\s*\(|db_name\s*\(/i,
  ];
  
  // Normalize input to prevent obfuscation (e.g., replace multi-spaces, trim)
  const normalizedInput = input.toLowerCase().replace(/\s+/g, ' ').trim();

  return sqlPatterns.some(pattern => pattern.test(normalizedInput));
}

/*
// Example Usage in an API route (requires Next.js/similar framework context):

// import { NextResponse } from 'next/server'; // Assumed import

// const userInput = req.query.id as string; // Assumed request handling

// if (containsSqlInjection(userInput)) {
//   return NextResponse.json(
//     { error: 'Invalid input detected: potential SQL injection attempt' },
//     { status: 400 }
//   );
// }
*/