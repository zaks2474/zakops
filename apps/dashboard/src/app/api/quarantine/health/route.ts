import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8091';

/**
 * GET /api/quarantine/health
 *
 * Returns quarantine queue health status.
 * Computes from quarantine items count.
 */
export async function GET(request: NextRequest) {
  try {
    // Fetch quarantine items to compute health
    const response = await fetch(`${BACKEND_URL}/api/quarantine`, {
      headers: { 'Content-Type': 'application/json' },
    });

    let items: any[] = [];
    if (response.ok) {
      const data = await response.json();
      items = Array.isArray(data) ? data : (data.items || []);
    }

    // Compute health metrics
    const pendingItems = items.filter((item: any) =>
      item.status === 'PENDING' || item.status === 'pending' || !item.status
    );

    // Calculate oldest pending item age
    let oldestPendingDays = 0;
    if (pendingItems.length > 0) {
      const now = new Date();
      pendingItems.forEach((item: any) => {
        const created = item.created_at || item.timestamp || item.received_at;
        if (created) {
          const createdDate = new Date(created);
          const days = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          if (days > oldestPendingDays) {
            oldestPendingDays = days;
          }
        }
      });
    }

    // Determine status based on pending count and age
    let status = 'healthy';
    if (pendingItems.length > 50 || oldestPendingDays > 7) {
      status = 'critical';
    } else if (pendingItems.length > 20 || oldestPendingDays > 3) {
      status = 'warning';
    }

    return NextResponse.json({
      status,
      pending_items: pendingItems.length,
      oldest_pending_days: oldestPendingDays,
    });
  } catch (error) {
    console.error('[Quarantine Health] Error:', error);
    // Return healthy status with 0 pending on error
    return NextResponse.json({
      status: 'healthy',
      pending_items: 0,
      oldest_pending_days: 0,
    });
  }
}
