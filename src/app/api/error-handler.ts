// src/app/api/error-handler.ts
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Interface for known database error structure (e.g., from 'pg' or similar)
interface DbError {
  code?: string;
  message: string;
}

// Use 'unknown' instead of 'any' for the error parameter
export function handleApiError(error: unknown, context?: string) {
  
  // FIX: Cast 'error' to 'any' or 'Error' (if the logger accepts it) 
  // before passing it to logger.error, as the logger likely has a more
  // constrained type signature that doesn't accept 'unknown' directly.
  logger.error(context || 'API Error', error as Error); // Assuming logger accepts Error
  
  // Type guard to narrow the error to an object with properties
  const isDbError = (err: unknown): err is DbError => {
    return typeof err === 'object' && err !== null && 'message' in err;
  }

  if (isDbError(error)) {
    // Known error types
    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'Duplicate entry' },
        { status: 409 }
      );
    }
    
    // Check for foreign key constraint violation
    if (error.message?.includes('violates foreign key')) {
      return NextResponse.json(
        { success: false, error: 'Referenced resource not found' },
        { status: 400 }
      );
    }
  }

  // Determine the error message for the client
  let clientErrorMessage = 'An error occurred';
  if (process.env.NODE_ENV !== 'production' && isDbError(error)) {
    clientErrorMessage = error.message;
  }
  
  // Generic error
  return NextResponse.json(
    { 
      success: false, 
      error: clientErrorMessage 
    },
    { status: 500 }
  );
}