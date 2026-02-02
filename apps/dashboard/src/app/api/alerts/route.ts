import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8091';

/**
 * GET /api/alerts
 *
 * Returns system alerts computed from deals, actions, and quarantine.
 * This is a computed endpoint that aggregates alerts from various sources.
 */
export async function GET(request: NextRequest) {
  try {
    const alerts: any[] = [];

    // Fetch data in parallel
    const [dealsRes, actionsRes, quarantineRes] = await Promise.allSettled([
      fetch(`${BACKEND_URL}/api/deals?status=active`),
      fetch(`${BACKEND_URL}/api/actions`),
      fetch(`${BACKEND_URL}/api/quarantine`),
    ]);

    // Process deals for stale deal alerts
    if (dealsRes.status === 'fulfilled' && dealsRes.value.ok) {
      const deals = await dealsRes.value.json();
      const dealsList = Array.isArray(deals) ? deals : (deals.deals || []);

      // Find stale deals (no update in 7+ days)
      const staleDeals = dealsList.filter((d: any) => d.days_since_update && d.days_since_update > 7);
      if (staleDeals.length > 0) {
        alerts.push({
          type: 'stale_deals',
          severity: staleDeals.length > 5 ? 'high' : 'warning',
          message: `${staleDeals.length} deal(s) have not been updated in over 7 days`,
          count: staleDeals.length,
          actions: ['Review stale deals', 'Update deal status'],
        });
      }

      // Find high priority deals
      const highPriorityDeals = dealsList.filter((d: any) => d.priority === 'HIGHEST');
      if (highPriorityDeals.length > 0) {
        alerts.push({
          type: 'high_priority_deals',
          severity: 'warning',
          message: `${highPriorityDeals.length} high priority deal(s) require attention`,
          count: highPriorityDeals.length,
          actions: ['Review high priority deals'],
        });
      }
    }

    // Process actions for failed action alerts
    if (actionsRes.status === 'fulfilled' && actionsRes.value.ok) {
      const actions = await actionsRes.value.json();
      const actionsList = Array.isArray(actions) ? actions : (actions.actions || []);

      // Find failed actions
      const failedActions = actionsList.filter((a: any) => a.status === 'FAILED');
      if (failedActions.length > 0) {
        alerts.push({
          type: 'failed_actions',
          severity: 'high',
          message: `${failedActions.length} action(s) have failed and need review`,
          count: failedActions.length,
          actions: ['Review failed actions', 'Retry or cancel'],
        });
      }

      // Find actions pending approval for too long
      const pendingActions = actionsList.filter((a: any) => a.status === 'PENDING_APPROVAL');
      if (pendingActions.length > 10) {
        alerts.push({
          type: 'pending_approvals',
          severity: 'warning',
          message: `${pendingActions.length} action(s) are awaiting approval`,
          count: pendingActions.length,
          actions: ['Review pending approvals'],
        });
      }
    }

    // Process quarantine for backlog alerts
    if (quarantineRes.status === 'fulfilled' && quarantineRes.value.ok) {
      const quarantine = await quarantineRes.value.json();
      const items = Array.isArray(quarantine) ? quarantine : (quarantine.items || []);

      if (items.length > 20) {
        alerts.push({
          type: 'quarantine_backlog',
          severity: items.length > 50 ? 'high' : 'warning',
          message: `${items.length} item(s) in quarantine queue need review`,
          count: items.length,
          actions: ['Process quarantine queue'],
        });
      }
    }

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('[Alerts] Error:', error);
    return NextResponse.json(
      { error: 'backend_unavailable', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 502 }
    );
  }
}
