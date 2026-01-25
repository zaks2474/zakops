/**
 * useRenderTracking Hook
 *
 * Development-only hook to track component renders
 * and warn about potential infinite loops.
 *
 * Usage:
 *   function MyComponent() {
 *     useRenderTracking('MyComponent');
 *     // ...
 *   }
 */

'use client';

import { useEffect, useRef } from 'react';
import { uiLogger } from '@/lib/observability';

/**
 * Track renders for a component (development only)
 */
export function useRenderTracking(componentName: string): void {
  // Only track in development
  if (process.env.NODE_ENV !== 'development') return;

  // Track this render
  uiLogger.trackRender(componentName);
}

/**
 * Log render count on unmount (useful for debugging)
 */
export function useRenderCount(componentName: string): number {
  const renderCount = useRef(0);
  renderCount.current++;

  useEffect(() => {
    return () => {
      if (process.env.NODE_ENV === 'development' && renderCount.current > 10) {
        console.debug(`[RENDER] ${componentName} total renders: ${renderCount.current}`);
      }
    };
  }, [componentName]);

  return renderCount.current;
}
