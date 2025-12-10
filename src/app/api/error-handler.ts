//src/app/api/error-handler.ts
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export function handleApiError(error: any, context?: string) {
  logger.error(context || 'API Error', error);
  
  // Known error types
  if (error.code === '23505') {
    return NextResponse.json(
      { success: false, error: 'Duplicate entry' },
      { status: 409 }
    );
  }
  
  if (error.message?.includes('violates foreign key')) {
    return NextResponse.json(
      { success: false, error: 'Referenced resource not found' },
      { status: 400 }
    );
  }
  
  // Generic error
  return NextResponse.json(
    { 
      success: false, 
      error: process.env.NODE_ENV === 'production' 
        ? 'An error occurred' 
        : error.message 
    },
    { status: 500 }
  );
}

// Usage:
try {
  // ... your code
} catch (error) {
  return handleApiError(error, 'Service Creation');
}