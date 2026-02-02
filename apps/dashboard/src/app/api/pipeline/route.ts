/**
 * Pipeline Summary API Endpoint
 * GET /api/pipeline
 *
 * Returns the deal pipeline summary with stage counts and metrics.
 * Transforms backend /api/pipeline/summary (array) into the shape
 * expected by PipelineResponseSchema: {total_active, stages: Record<...>}
 */

import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:8091';

interface BackendStageSummary {
  stage: string;
  count: number;
  avg_days_in_stage: number;
}

export async function GET() {
  try {
    // Fetch both pipeline summary and deals in parallel
    const [summaryResponse, dealsResponse] = await Promise.all([
      fetch(`${BACKEND_URL}/api/pipeline/summary`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }),
      fetch(`${BACKEND_URL}/api/deals`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }),
    ]);

    const deals = dealsResponse.ok
      ? await dealsResponse.json().then(d => Array.isArray(d) ? d : d.deals || [])
      : [];

    if (summaryResponse.ok) {
      const summaryData: BackendStageSummary[] = await summaryResponse.json();

      // Transform array into the shape the dashboard expects
      const stages: Record<string, {
        count: number;
        deals: Array<{ deal_id: string; canonical_name: string | null; days_in_stage: number }>;
        avg_age: number;
      }> = {};

      let totalActive = 0;

      for (const entry of summaryData) {
        const stageDeals = deals
          .filter((d: { stage: string }) => d.stage === entry.stage)
          .map((d: { deal_id: string; canonical_name: string | null; days_since_update?: number }) => ({
            deal_id: d.deal_id,
            canonical_name: d.canonical_name,
            days_in_stage: d.days_since_update || 0,
          }));

        stages[entry.stage] = {
          count: entry.count,
          deals: stageDeals,
          avg_age: entry.avg_days_in_stage || 0,
        };
        totalActive += entry.count;
      }

      return NextResponse.json({
        total_active: totalActive,
        stages,
      });
    }

    // Fallback: build from deals alone
    if (deals.length > 0) {
      const stages: Record<string, {
        count: number;
        deals: Array<{ deal_id: string; canonical_name: string | null; days_in_stage: number }>;
        avg_age: number;
      }> = {};

      for (const deal of deals) {
        const stage = deal.stage || 'unknown';
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

      for (const stage of Object.keys(stages)) {
        const totalDays = stages[stage].deals.reduce((sum, d) => sum + d.days_in_stage, 0);
        stages[stage].avg_age = stages[stage].count > 0 ? Math.round(totalDays / stages[stage].count) : 0;
      }

      return NextResponse.json({
        total_active: deals.length,
        stages,
      });
    }

    return NextResponse.json(
      { error: 'backend_unavailable', message: 'Cannot build pipeline data' },
      { status: 502 }
    );
  } catch (error) {
    console.error('[Pipeline] Backend error:', error);
    return NextResponse.json(
      { error: 'backend_unavailable', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 502 }
    );
  }
}
