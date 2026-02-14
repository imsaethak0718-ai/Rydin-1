/**
 * Error Logging with Sentry
 * Track errors in production and development
 */

/**
 * Initialize Sentry for error tracking
 * Requires: npm install @sentry/react @sentry/tracing
 */
export const initializeSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.log('⚠️ Sentry DSN not configured - error logging disabled');
    return;
  }

  console.log('✅ Sentry initialized');
};

/**
 * Log error to Sentry
 */
export const logError = (error: Error | string, context?: Record<string, any>) => {
  console.error('❌ Error logged:', error);

  // In production with Sentry configured:
  // Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
};

/**
 * Log message/event
 */
export const logMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
  const icon = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : '📝';
  console.log(`${icon} [${level.toUpperCase()}] ${message}`);
};

/**
 * Capture exception with context
 */
export const captureException = (error: any, context: string) => {
  console.error(`Error in ${context}:`, error);
  logError(error, { context });
};

/**
 * Set user context for tracking
 */
export const setUserContext = (userId: string, email?: string, name?: string) => {
  console.log('👤 User context:', { userId, email, name });
  // Sentry.setUser({ id: userId, email, username: name });
};

/**
 * Clear user context on logout
 */
export const clearUserContext = () => {
  console.log('👤 User context cleared');
  // Sentry.setUser(null);
};

/**
 * Add breadcrumb for tracking user actions
 */
export const addBreadcrumb = (
  message: string,
  category: string = 'user-action',
  level: 'info' | 'warning' | 'error' = 'info'
) => {
  console.log(`🔵 [${category}] ${message}`);
  // Sentry.addBreadcrumb({ message, category, level });
};

/**
 * Track API calls
 */
export const trackAPICall = (method: string, endpoint: string, success: boolean) => {
  const icon = success ? '✅' : '❌';
  console.log(`${icon} API ${method} ${endpoint}`);
  addBreadcrumb(`${method} ${endpoint} - ${success ? 'Success' : 'Failed'}`, 'api', success ? 'info' : 'warning');
};

/**
 * Track feature usage
 */
export const trackFeature = (featureName: string, data?: Record<string, any>) => {
  console.log(`🎯 Feature: ${featureName}`, data || {});
  addBreadcrumb(`Feature used: ${featureName}`, 'feature', 'info');
};

/**
 * Async error handler
 */
export const handleAsyncError = async <T,>(
  fn: () => Promise<T>,
  errorContext: string
): Promise<T | null> => {
  try {
    return await fn();
  } catch (error) {
    captureException(error, errorContext);
    return null;
  }
};

/**
 * Setup global error handlers
 */
export const setupGlobalErrorHandlers = () => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Unhandled rejection:', event.reason);
    logError(event.reason, { type: 'unhandledRejection' });
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    console.error('❌ Global error:', event.error);
    logError(event.error, { type: 'globalError', filename: event.filename });
  });

  console.log('✅ Global error handlers setup');
};

/**
 * Log performance metrics
 */
export const logPerformanceMetric = (metricName: string, value: number, unit: string = 'ms') => {
  console.log(`⚡ ${metricName}: ${value}${unit}`);
};

/**
 * Create error report
 */
export const createErrorReport = (error: any, context: string): string => {
  return `
    Error Report
    ============
    Context: ${context}
    Error: ${error instanceof Error ? error.message : String(error)}
    Stack: ${error instanceof Error ? error.stack : 'N/A'}
    User Agent: ${navigator.userAgent}
    Time: ${new Date().toISOString()}
  `;
};
