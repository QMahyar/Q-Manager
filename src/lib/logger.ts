/**
 * Structured logging utility for Q Manager frontend.
 * 
 * Provides consistent log formatting with levels, timestamps, and context.
 * In production, only warnings and errors are logged.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  /** Component or module name */
  source?: string;
  /** Account ID if applicable */
  accountId?: number;
  /** Action being performed */
  action?: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

// Determine if we're in development mode
const isDev = import.meta.env.DEV;

// Log level priority for filtering
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Minimum log level based on environment
const MIN_LOG_LEVEL: LogLevel = isDev ? 'debug' : 'warn';

/**
 * Format a log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
  ];
  
  if (entry.context?.source) {
    parts.push(`[${entry.context.source}]`);
  }
  
  parts.push(entry.message);
  
  return parts.join(' ');
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

/**
 * Create a log entry
 */
function createLogEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };
}

/**
 * Output a log entry to the console
 */
function outputLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry);
  const contextData = entry.context?.data;
  
  switch (entry.level) {
    case 'debug':
      if (contextData) {
        console.debug(formatted, contextData);
      } else {
        console.debug(formatted);
      }
      break;
    case 'info':
      if (contextData) {
        console.info(formatted, contextData);
      } else {
        console.info(formatted);
      }
      break;
    case 'warn':
      if (contextData) {
        console.warn(formatted, contextData);
      } else {
        console.warn(formatted);
      }
      break;
    case 'error':
      if (contextData) {
        console.error(formatted, contextData);
      } else {
        console.error(formatted);
      }
      break;
  }
}

/**
 * Logger interface type
 */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  logError(error: unknown, message: string, context?: LogContext): void;
  child(defaultContext: LogContext): Logger;
}

/**
 * Main logger interface
 */
export const logger: Logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug')) {
      outputLog(createLogEntry('debug', message, context));
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog('info')) {
      outputLog(createLogEntry('info', message, context));
    }
  },

  warn(message: string, context?: LogContext): void {
    if (shouldLog('warn')) {
      outputLog(createLogEntry('warn', message, context));
    }
  },

  error(message: string, context?: LogContext): void {
    if (shouldLog('error')) {
      outputLog(createLogEntry('error', message, context));
    }
  },

  /**
   * Log an error with automatic extraction of error details
   */
  logError(error: unknown, message: string, context?: LogContext): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error(message, {
      ...context,
      data: {
        ...context?.data,
        errorMessage,
        errorStack,
      },
    });
  },

  /**
   * Create a child logger with preset context
   */
  child(defaultContext: LogContext): Logger {
    const parentLogger = logger;
    return {
      debug: (message: string, context?: LogContext) => 
        parentLogger.debug(message, { ...defaultContext, ...context }),
      info: (message: string, context?: LogContext) => 
        parentLogger.info(message, { ...defaultContext, ...context }),
      warn: (message: string, context?: LogContext) => 
        parentLogger.warn(message, { ...defaultContext, ...context }),
      error: (message: string, context?: LogContext) => 
        parentLogger.error(message, { ...defaultContext, ...context }),
      logError: (error: unknown, message: string, context?: LogContext) => 
        parentLogger.logError(error, message, { ...defaultContext, ...context }),
      child: (childContext: LogContext) => 
        parentLogger.child({ ...defaultContext, ...childContext }),
    };
  },
};

/**
 * Create a logger for a specific component/module
 */
export function createLogger(source: string): typeof logger {
  return logger.child({ source });
}

// Pre-configured loggers for common modules
export const apiLogger = createLogger('API');
export const workerLogger = createLogger('Worker');
export const uiLogger = createLogger('UI');
export const eventLogger = createLogger('Event');
