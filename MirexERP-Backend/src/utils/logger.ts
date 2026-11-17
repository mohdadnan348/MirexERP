
import { env } from "../config/env";

/**
 * Supported log levels.
 */
type LogLevel = "error" | "warn" | "info" | "http" | "debug";

type LogMetadata = Record<string, unknown>;

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  environment: string;
  metadata?: LogMetadata;
}

/**
 * Numeric priority of each log level.
 * Lower value means higher priority.
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

/**
 * Convert configured log level into a supported level.
 */
const getConfiguredLogLevel = (): LogLevel => {
  const level = env.LOG_LEVEL.toLowerCase();

  if (level in LOG_LEVEL_PRIORITY) {
    return level as LogLevel;
  }

  return "info";
};

const configuredLogLevel = getConfiguredLogLevel();

/**
 * Check whether a log should be displayed.
 */
const shouldLog = (level: LogLevel): boolean => {
  return (
    LOG_LEVEL_PRIORITY[level] <=
    LOG_LEVEL_PRIORITY[configuredLogLevel]
  );
};

/**
 * Safely serialize metadata.
 */
const sanitizeMetadata = (
  metadata?: LogMetadata
): LogMetadata | undefined => {
  if (!metadata) {
    return undefined;
  }

  const sensitiveKeys = [
    "password",
    "token",
    "authorization",
    "accessToken",
    "refreshToken",
    "secret",
    "cookie",
  ];

  const sanitized: LogMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    const isSensitive = sensitiveKeys.some((sensitiveKey) =>
      key.toLowerCase().includes(sensitiveKey.toLowerCase())
    );

    sanitized[key] = isSensitive
      ? "[REDACTED]"
      : value instanceof Error
        ? {
            name: value.name,
            message: value.message,
            stack: value.stack,
          }
        : value;
  }

  return sanitized;
};

/**
 * Format a structured log entry.
 */
const formatLog = (
  level: LogLevel,
  message: string,
  metadata?: LogMetadata
): LogEntry => {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    metadata: sanitizeMetadata(metadata),
  };
};

/**
 * Write log entry to the appropriate console stream.
 */
const writeLog = (
  level: LogLevel,
  message: string,
  metadata?: LogMetadata
): void => {
  if (!shouldLog(level)) {
    return;
  }

  const entry = formatLog(level, message, metadata);
  const output = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(output);
      break;

    case "warn":
      console.warn(output);
      break;

    case "debug":
      console.debug(output);
      break;

    default:
      console.log(output);
      break;
  }
};

/**
 * Centralized application logger.
 */
export const logger = {
  error: (message: string, metadata?: LogMetadata): void => {
    writeLog("error", message, metadata);
  },

  warn: (message: string, metadata?: LogMetadata): void => {
    writeLog("warn", message, metadata);
  },

  info: (message: string, metadata?: LogMetadata): void => {
    writeLog("info", message, metadata);
  },

  http: (message: string, metadata?: LogMetadata): void => {
    writeLog("http", message, metadata);
  },

  debug: (message: string, metadata?: LogMetadata): void => {
    writeLog("debug", message, metadata);
  },
};