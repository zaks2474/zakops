import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8091';

/**
 * GET /api/deferred-actions/due
 *
 * Returns actions that are due for execution.
 * Proxies to /api/actions and filters for due items.
 */
export async function GET(request: NextRequest) {
  try {
    // Fetch all actions and filter for due ones
    const response = await fetch(`${BACKEND_URL}/api/actions`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      // Return empty array on error - graceful degradation
      return NextResponse.json([]);
    }

    const actions = await response.json();

    // Filter for actions that are due (PENDING_APPROVAL, READY, or QUEUED status)
    const dueStatuses = ['PENDING_APPROVAL', 'READY', 'QUEUED'];
    const dueActions = Array.isArray(actions)
      ? actions.filter((a: any) => dueStatuses.includes(a.status))
      : [];

    return NextResponse.json(dueActions);
  } catch (error) {
    console.error('[Deferred Actions Due] Error:', error);
    // Return empty array on error for graceful degradation
    return NextResponse.json([]);
  }
}
