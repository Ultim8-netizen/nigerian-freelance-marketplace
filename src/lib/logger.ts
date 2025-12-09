// src/lib/logger.ts
// Production-ready error logging and monitoring

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: Error;
  userId?: string;
  url?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  /**
   * Log information message
   */
  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context);
  }

  /**
   * Log error with full context
   */
  error(message: string, error?: Error, context?: Record<string, any>) {
    this.log('error', message, { ...context, error });

    // In production, send to error tracking service
    if (!this.isDevelopment) {
      this.sendToErrorTracking({ message, error, context });
    }
  }

  /**
   * Log debug information (development only)
   */
  debug(message: string, context?: Record<string, any>) {
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
    context?: Record<string, any>
  ) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    // Store log
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output with formatting
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
      console.log(`%c${emoji} [${level.toUpperCase()}]`, style, message, context || '');
    } else if (level === 'error' || level === 'warn') {
      // Only log errors/warnings in production
      console[level](message, context);
    }
  }

  /**
   * Send error to tracking service (e.g., Sentry, LogRocket)
   */
  private async sendToErrorTracking(data: {
    message: string;
    error?: Error;
    context?: Record<string, any>;
  }) {
    try {
      // TODO: Integrate with error tracking service
      // Example: Sentry, LogRocket, Datadog, etc.
      
      // For now, send to backend endpoint
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
      // Silently fail - don't crash the app due to logging
      console.error('Failed to send error to tracking:', error);
    }
  }

  /**
   * Get recent logs (useful for debugging)
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
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
    logger.error(
      context || 'Async operation failed',
      error as Error,
      { context }
    );
    throw error;
  }
}

/**
 * API error handler
 */
export function handleApiError(error: any): {
  success: false;
  error: string;
  statusCode: number;
} {
  logger.error('API Error', error);

  // Known error types
  if (error.message?.includes('fetch failed')) {
    return {
      success: false,
      error: 'Network error. Please check your connection.',
      statusCode: 503,
    };
  }

  if (error.message?.includes('timeout')) {
    return {
      success: false,
      error: 'Request timeout. Please try again.',
      statusCode: 408,
    };
  }

  if (error.message?.includes('unauthorized')) {
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
      : error.message || 'Unknown error',
    statusCode: 500,
  };
}