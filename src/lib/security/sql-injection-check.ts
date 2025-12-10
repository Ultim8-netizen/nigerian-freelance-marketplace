// src/lib/security/sql-injection-check.ts
export function containsSqlInjection(input: string): boolean {
  const sqlPatterns = [
    /(\bor\b|\band\b).*?=/i,
    /union.*select/i,
    /drop\s+table/i,
    /--/,
    /;.*select/i,
    /'.*or.*'/i,
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
}

// Usage in API routes before processing:
if (containsSqlInjection(userInput)) {
  return NextResponse.json(
    { error: 'Invalid input detected' },
    { status: 400 }
  );
}