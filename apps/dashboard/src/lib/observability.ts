/**
 * UI Observability Layer
 *
 * Provides logging, error tracking, and render monitoring
 * to catch future issues like infinite re-renders.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: 'navigation' | 'api' | 'ui' | 'render' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

interface RenderTrack {
  count: number;
  lastReset: number;
  warned: boolean;
}

const RENDER_WARN_THRESHOLD = 10;
const RENDER_RESET_INTERVAL = 5000; // Reset counter every 5 seconds

class UIObservability {
  private logs: LogEntry[] = [];
  private renderCounts: Map<string, RenderTrack> = new Map();
  private maxLogs = 200;
  private enabled = typeof window !== 'undefined';

  /**
   * Log a message with category and optional data
   */
  log(
    level: LogLevel,
    category: LogEntry['category'],
    message: string,
    data?: Record<string, unknown>
  ) {
    if (!this.enabled) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(entry);

    // Trim logs if too many
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Output to console
    const prefix = `[${category.toUpperCase()}]`;
    const logData = data ? [prefix, message, data] : [prefix, message];

    switch (level) {
      case 'error':
        console.error(...logData);
        break;
      case 'warn':
        console.warn(...logData);
        break;
      case 'debug':
        // Only in development
        if (process.env.NODE_ENV === 'development') {
          console.debug(...logData);
        }
        break;
      default:
        console.log(...logData);
    }
  }

  /**
   * Track component renders to detect infinite loops
   */
  trackRender(componentName: string): void {
    if (!this.enabled) return;

    const now = Date.now();
    let track = this.renderCounts.get(componentName);

    if (!track) {
      track = { count: 0, lastReset: now, warned: false };
      this.renderCounts.set(componentName, track);
    }

    // Reset counter if enough time has passed
    if (now - track.lastReset > RENDER_RESET_INTERVAL) {
      track.count = 0;
      track.lastReset = now;
      track.warned = false;
    }

    track.count++;

    // Warn if too many renders in short time
    if (track.count > RENDER_WARN_THRESHOLD && !track.warned) {
      track.warned = true;
      this.log(
        'warn',
        'render',
        `${componentName} rendered ${track.count} times in ${RENDER_RESET_INTERVAL}ms - possible infinite loop`,
        { component: componentName, renderCount: track.count }
      );
    }
  }

  /**
   * Track navigation events
   */
  trackNavigation(from: string, to: string, success: boolean) {
    this.log(success ? 'info' : 'error', 'navigation', `${from} → ${to}`, {
      from,
      to,
      success,
    });
  }

  /**
   * Track API calls
   */
  trackApiCall(
    method: string,
    url: string,
    status: number,
    duration: number
  ) {
    const level = status >= 400 ? 'error' : 'debug';
    this.log(level, 'api', `${method} ${url} → ${status} (${duration}ms)`, {
      method,
      url,
      status,
      duration,
    });
  }

  /**
   * Track errors
   */
  trackError(error: Error, context?: string) {
    this.log('error', 'error', `${context || 'Error'}: ${error.message}`, {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
    });
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get render counts for debugging
   */
  getRenderCounts(): Record<string, number> {
    const result: Record<string, number> = {};
    this.renderCounts.forEach((track, name) => {
      result[name] = track.count;
    });
    return result;
  }

  /**
   * Clear all logs and render counts
   */
  clear() {
    this.logs = [];
    this.renderCounts.clear();
  }
}

// Singleton instance
export const uiLogger = new UIObservability();

// Global error handler for unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));
    uiLogger.trackError(error, 'Unhandled Promise Rejection');
  });

  window.addEventListener('error', (event) => {
    uiLogger.trackError(event.error || new Error(event.message), 'Uncaught Error');
  });
}

// Export types
export type { LogEntry, LogLevel };
