/**
 * Route utilities for safe link generation
 *
 * Ensures all links point to existing routes and prevents 404s
 */

export type RouteType = 'deal' | 'action' | 'quarantine' | 'approval';

/**
 * Generate a safe href for a given item type and ID
 * Uses query params for list pages that support selection
 */
export function getItemHref(type: RouteType, id: string): string {
  const routes: Record<RouteType, string> = {
    deal: `/deals/${id}`,                    // Detail page exists
    action: `/actions?selected=${id}`,       // List page with selection
    quarantine: `/quarantine?selected=${id}`, // List page with selection
    approval: `/actions?selected=${id}`,     // Approvals are actions
  };

  return routes[type] || '/dashboard';
}

/**
 * All valid routes in the application
 */
export const VALID_ROUTES = [
  '/',
  '/dashboard',
  '/deals',
  '/deals/[id]',
  '/actions',
  '/quarantine',
  '/chat',
  '/onboarding',
  '/hq',
] as const;

/**
 * Check if a route pattern is valid
 */
export function isValidRoute(path: string): boolean {
  // Check exact matches
  if (VALID_ROUTES.includes(path as any)) return true;

  // Check dynamic routes
  if (path.startsWith('/deals/') && path.split('/').length === 3) return true;

  // Check query param routes
  if (path.startsWith('/actions?') || path.startsWith('/quarantine?')) return true;

  return false;
}
