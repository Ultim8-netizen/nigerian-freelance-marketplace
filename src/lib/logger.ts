// src/lib/logger.ts
// Production-ready error logging and monitoring - Optimized for structured error context.

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error;
  userId?: string;
  url?: string;
}

/**
 * Type guard to check if an unknown object is an instance of Error.
 */
function isError(err: unknown): err is Error {
  return err instanceof Error;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  // ... (info, warn, debug methods remain unchanged)

  info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context);
  }

  /**
   * Log error with full context.
   * FIX: Modified signature to allow passing either an Error object OR a structured context object.
   * @param errorOrContext The actual Error object OR a structured context object (including a separate 'error' property).
   * @param optionalContext If errorOrContext was an Error, this is for additional context.
   */
  error(
    message: string,
    errorOrContext?: Error | Record<string, unknown>, // Supports either an Error or Context
    optionalContext?: Record<string, unknown>
  ) {
    let error: Error | undefined;
    let context: Record<string, unknown> | undefined;

    if (isError(errorOrContext)) {
      // Pattern 1: logger.error('msg', actualError, context)
      error = errorOrContext;
      context = optionalContext;
    } else if (errorOrContext) {
      // Pattern 2: logger.error('msg', { userId: '123', error: supabaseError })
      context = errorOrContext;
      // Extract Error from context if present
      if (context.error && isError(context.error)) {
        error = context.error as Error;
        // Remove error from context to avoid duplication in LogEntry
        delete context.error; 
      }
    }

    this.log('error', message, context, error);

    // In production, send to error tracking service
    if (!this.isDevelopment) {
      this.sendToErrorTracking({ message, error, context });
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (this.isDevelopment) {
      this.log('debug', message, context);
    }
  }

  /**
   * Core logging function
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error // Added optional Error parameter
  ) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
      userId: context?.userId as string, // Attempt to pull userId from context
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    // Store log
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output with formatting (remains the same)
    const emoji = {
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      debug: '🔍',
    }[level];

    const style = {
      info: 'color: #3B82F6',
      warn: 'color: #F59E0B',
      error: 'color: #EF4444',
      debug: 'color: #8B5CF6',
    }[level];

    if (this.isDevelopment) {
      // Consolidated console log
      console.log(`%c${emoji} [${level.toUpperCase()}]`, style, message, entry.context || '', entry.error || '');
    } else if (level === 'error' || level === 'warn') {
      console[level](message, entry.context, entry.error);
    }
  }

  // ... (sendToErrorTracking, getLogs, clearLogs, exportLogs methods remain unchanged)
  private async sendToErrorTracking(data: {
    message: string;
    error?: Error;
    context?: Record<string, unknown>;
  }) {
    // ... implementation for sending error tracking ...
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: data.message,
          stack: data.error?.stack,
          context: data.context,
          timestamp: new Date().toISOString(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        }),
      });
    } catch (error) {
      console.error('Failed to send error to tracking:', error);
    }
  }
}

// Singleton instance
export const logger = new Logger();

/**
 * Async error wrapper with automatic logging
 */
export async function withErrorLogging<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const errorObject = isError(error) ? error : new Error(String(error));
    
    // Now correctly uses the Error object as the second argument
    logger.error(
      context || 'Async operation failed',
      errorObject,
      { context }
    );
    throw error;
  }
}

/**
 * API error handler
 */
export function handleApiError(error: unknown): {
  success: false;
  error: string;
  statusCode: number;
} {
  const errorObject = isError(error) ? error : new Error(String(error));
  
  // Now correctly uses the Error object as the second argument
  logger.error('API Error', errorObject);
  
  const errorMessage = errorObject.message; // Use the message from the guaranteed Error object

  // Known error types
  // ... (error handling logic remains the same)
  if (errorMessage.includes('fetch failed')) {
    return {
      success: false,
      error: 'Network error. Please check your connection.',
      statusCode: 503,
    };
  }

  if (errorMessage.includes('timeout')) {
    return {
      success: false,
      error: 'Request timeout. Please try again.',
      statusCode: 408,
    };
  }

  if (errorMessage.includes('unauthorized')) {
    return {
      success: false,
      error: 'You are not authorized. Please login.',
      statusCode: 401,
    };
  }

  // Generic error
  return {
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'An error occurred. Please try again.'
      : errorMessage || 'Unknown error',
    statusCode: 500,
  };
}