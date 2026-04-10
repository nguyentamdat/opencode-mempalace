/**
 * MemPalace Error Classification
 * 
 * Following OMO patterns: hierarchical error classification for retry logic
 * and better error handling throughout the plugin.
 */

export interface ErrorInfo {
  name: string;
  message: string;
  code?: string;
  stack?: string;
}

// CLI/Spawn related errors that are retryable
const RETRYABLE_SPAWN_ERRORS = new Set([
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EAGAIN",
  "EBUSY",
  "ENOENT", // Might be temporary PATH issue
]);

// Palace/MemPalace specific errors that should retry
const RETRYABLE_MEMPALACE_PATTERNS = [
  /timeout/i,
  /temporarily unavailable/i,
  /rate limit/i,
  /busy/i,
  /try again/i,
  /locked/i,
];

// Errors that indicate permanent failures (don't retry)
const PERMANENT_ERROR_PATTERNS = [
  /not found/i,
  /invalid/i,
  /unauthorized/i,
  /forbidden/i,
  /not installed/i,
];

/**
 * Check if an error from spawn/CLI operations is retryable
 */
export function isRetryableSpawnError(error: Error | ErrorInfo): boolean {
  const errorCode = (error as NodeJS.ErrnoException).code;
  const errorMessage = error.message || "";
  
  // Check error code first
  if (errorCode && RETRYABLE_SPAWN_ERRORS.has(errorCode)) {
    return true;
  }
  
  // Check for permanent failure patterns first (they take precedence)
  for (const pattern of PERMANENT_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return false;
    }
  }
  
  // Check retryable patterns
  for (const pattern of RETRYABLE_MEMPALACE_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Classify initialization errors
 */
export function classifyInitError(error: Error): "missing_dependency" | "timeout" | "unknown" {
  const message = error.message.toLowerCase();
  
  if (message.includes("not found") || message.includes("not installed") || message.includes("enoent")) {
    return "missing_dependency";
  }
  
  if (message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }
  
  return "unknown";
}

/**
 * Create a structured error object for consistent logging
 */
export function createErrorInfo(error: Error): ErrorInfo {
  return {
    name: error.name,
    message: error.message,
    code: (error as NodeJS.ErrnoException).code,
    stack: error.stack,
  };
}

/**
 * Safe wrapper for async operations with error classification
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context: string
): Promise<{ success: true; data: T } | { success: false; error: ErrorInfo; retryable: boolean }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const errorInfo = createErrorInfo(error);
    const retryable = isRetryableSpawnError(error);
    
    console.warn(`[opencode-mempalace] ${context} failed:`, errorInfo.message);
    return { success: false, error: errorInfo, retryable };
  }
}
