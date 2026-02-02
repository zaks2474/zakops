/**
 * Pipeline Summary API Endpoint
 * GET /api/pipeline
 *
 * Returns the deal pipeline summary with stage counts and metrics.
 */

import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:8091';

export async function GET() {
  try {
    // Try to proxy to backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/pipeline`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (backendResponse.ok) {
      const data = await backendResponse.json();
      return NextResponse.json(data);
    }

    // If backend returns 404 or error, try to build from deals
    if (backendResponse.status === 404) {
      // Try to get deals and build pipeline from them
      const dealsResponse = await fetch(`${BACKEND_URL}/api/deals`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (dealsResponse.ok) {
        const dealsData = await dealsResponse.json();
        const deals = Array.isArray(dealsData) ? dealsData : dealsData.deals || [];

        // Build pipeline from deals
        const stages: Record<string, { count: number; deals: Array<{ deal_id: string; canonical_name: string | null; days_in_stage: number }>; avg_age: number }> = {};

        for (const deal of deals) {
          const stage = deal.stage || 'Unknown';
          if (!stages[stage]) {
            stages[stage] = { count: 0, deals: [], avg_age: 0 };
          }
          stages[stage].count++;
          stages[stage].deals.push({
            deal_id: deal.deal_id,
            canonical_name: deal.canonical_name,
            days_in_stage: deal.days_since_update || 0,
          });
        }

        // Calculate average age per stage
        for (const stage of Object.keys(stages)) {
          const totalDays = stages[stage].deals.reduce((sum, d) => sum + d.days_in_stage, 0);
          stages[stage].avg_age = stages[stage].count > 0 ? Math.round(totalDays / stages[stage].count) : 0;
        }

        return NextResponse.json({
          total_active: deals.length,
          stages,
        });
      }

      // Deals endpoint also failed - return 502
      return NextResponse.json(
        { error: 'backend_unavailable', message: 'Cannot build pipeline: backend returned 404 and deals endpoint failed' },
        { status: 502 }
      );
    }

    // Forward backend error
    const errorText = await backendResponse.text();
    return NextResponse.json(
      { error: errorText || 'Failed to get pipeline' },
      { status: backendResponse.status }
    );
  } catch (error) {
    console.error('[Pipeline] Backend error:', error);
    return NextResponse.json(
      { error: 'backend_unavailable', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 502 }
    );
  }
}
