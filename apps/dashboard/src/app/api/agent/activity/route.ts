/**
 * Agent Activity API Endpoint
 *
 * Returns current agent status, recent activity, stats, and run history.
 * GET /api/agent/activity?operatorId=xxx&dealId=yyy&limit=20
 *
 * REMEDIATION-V3: Mock data removed. Returns honest empty state
 * until agent activity tracking is wired to real backend data.
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  AgentActivityResponse,
  AgentStatus,
} from '@/types/agent-activity';

export async function GET(request: NextRequest) {
  const response: AgentActivityResponse = {
    status: 'idle' as AgentStatus,
    lastActivity: null,
    recent: [],
    stats: {
      toolsCalledToday: 0,
      approvalsProcessed: 0,
      dealsAnalyzed: 0,
      runsCompleted24h: 0,
    },
    currentRun: undefined,
    recentRuns: [],
  };

  return NextResponse.json(response);
}

export async function POST() {
  return NextResponse.json(
    { error: 'not_implemented', message: 'Agent run simulation not available' },
    { status: 501 }
  );
}
