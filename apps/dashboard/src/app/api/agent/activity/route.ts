/**
 * Agent Activity API Endpoint
 *
 * Unified endpoint for agent visibility layer.
 * Returns current status, recent activity, stats, and run history.
 *
 * GET /api/agent/activity?operatorId=xxx&dealId=yyy&limit=20
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  AgentActivityResponse,
  AgentActivityEvent,
  AgentActivityStats,
  AgentCurrentRun,
  AgentRecentRun,
  AgentStatus,
  AgentEventType,
} from '@/types/agent-activity';

// =============================================================================
// Status Determination (Deterministic Rules - CORRECT PRECEDENCE)
// =============================================================================

interface RunStatus {
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting_approval';
}

interface ActionStatus {
  status: 'pending_approval' | 'needs_approval' | 'approved' | 'rejected' | 'completed';
}

/**
 * Determine agent status with correct precedence:
 * waiting_approval > working > idle
 *
 * "Waiting for approval" is most actionable - operator needs to do something.
 * This should always surface even if a run is technically "running" but blocked.
 */
function determineAgentStatus(runs: RunStatus[], actions: ActionStatus[]): AgentStatus {
  // Rule 1: FIRST check if waiting for approval (most important for operator)
  if (actions.some(a => a.status === 'pending_approval' || a.status === 'needs_approval')) {
    return 'waiting_approval';
  }

  if (runs.some(r => r.status === 'waiting_approval')) {
    return 'waiting_approval';
  }

  // Rule 2: Then check if any run is actively executing
  if (runs.some(r => r.status === 'running')) {
    return 'working';
  }

  // Rule 3: Otherwise idle
  return 'idle';
}

// =============================================================================
// Mock Data (for development/demo)
// =============================================================================

const MOCK_EVENTS: AgentActivityEvent[] = [
  // Deal events
  {
    id: 'evt-1',
    type: 'deal.analyzed',
    label: 'Analyzed financials for TechWidget Inc',
    timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    dealId: 'DEAL-2026-001',
    dealName: 'TechWidget Inc',
  },
  {
    id: 'evt-3',
    type: 'deal.scored',
    label: 'Scored buy box fit for DataFlow Solutions',
    timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    dealId: 'DEAL-2026-002',
    dealName: 'DataFlow Solutions',
    metadata: { score: 82 },
  },
  {
    id: 'evt-6',
    type: 'deal.analyzed',
    label: 'Analyzed financials for CloudServe Pro',
    timestamp: new Date(Date.now() - 180000000).toISOString(), // 2 days ago
    dealId: 'DEAL-2026-003',
    dealName: 'CloudServe Pro',
  },
  {
    id: 'evt-10',
    type: 'deal.scored',
    label: 'Scored buy box fit for TechWidget Inc',
    timestamp: new Date(Date.now() - 4000000).toISOString(), // ~1 hour ago
    dealId: 'DEAL-2026-001',
    dealName: 'TechWidget Inc',
    metadata: { score: 78 },
  },
  // Communication events
  {
    id: 'evt-2',
    type: 'email.drafted',
    label: 'Drafted email to broker@quietlight.com',
    timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    dealId: 'DEAL-2026-001',
    dealName: 'TechWidget Inc',
    metadata: { recipient: 'broker@quietlight.com' },
  },
  {
    id: 'evt-7',
    type: 'loi.drafted',
    label: 'Drafted LOI for DataFlow Solutions',
    timestamp: new Date(Date.now() - 200000000).toISOString(), // ~2 days ago
    dealId: 'DEAL-2026-002',
    dealName: 'DataFlow Solutions',
  },
  // Document events
  {
    id: 'evt-4',
    type: 'doc.extracted',
    label: 'Extracted artifacts from CIM.pdf',
    timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    dealId: 'DEAL-2026-001',
    dealName: 'TechWidget Inc',
    metadata: { docName: 'CIM.pdf' },
  },
  {
    id: 'evt-8',
    type: 'doc.summarized',
    label: 'Summarized financial statements',
    timestamp: new Date(Date.now() - 250000000).toISOString(), // ~3 days ago
    dealId: 'DEAL-2026-002',
    dealName: 'DataFlow Solutions',
  },
  // Approval events
  {
    id: 'evt-5',
    type: 'approval.approved',
    label: 'Approved: Send NDA to broker',
    timestamp: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
    dealId: 'DEAL-2026-003',
    dealName: 'CloudServe Pro',
    metadata: { action: 'Send NDA to broker' },
  },
  {
    id: 'evt-9',
    type: 'approval.approved',
    label: 'Approved: Request additional documents',
    timestamp: new Date(Date.now() - 300000000).toISOString(), // ~3.5 days ago
    dealId: 'DEAL-2026-001',
    dealName: 'TechWidget Inc',
  },
  {
    id: 'evt-11',
    type: 'approval.requested',
    label: 'Approval needed: Send follow-up email',
    timestamp: new Date(Date.now() - 3500000).toISOString(), // ~1 hour ago
    dealId: 'DEAL-2026-002',
    dealName: 'DataFlow Solutions',
  },
];

const MOCK_RUNS: AgentRecentRun[] = [
  {
    runId: 'run-001',
    threadId: 'thread-001',
    status: 'completed',
    summary: 'Analyzed deal financials and scored buy box fit',
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: new Date(Date.now() - 3000000).toISOString(),
    dealId: 'DEAL-2026-001',
    dealName: 'TechWidget Inc',
    toolsCalled: 4,
    approvalsRequested: 1,
  },
  {
    runId: 'run-002',
    threadId: 'thread-002',
    status: 'completed',
    summary: 'Drafted broker response email',
    startedAt: new Date(Date.now() - 7200000).toISOString(),
    completedAt: new Date(Date.now() - 7000000).toISOString(),
    dealId: 'DEAL-2026-002',
    dealName: 'DataFlow Solutions',
    toolsCalled: 3,
    approvalsRequested: 1,
  },
  {
    runId: 'run-003',
    threadId: 'thread-003',
    status: 'completed',
    summary: 'Extracted documents and created summary',
    startedAt: new Date(Date.now() - 14400000).toISOString(), // 4 hours ago
    completedAt: new Date(Date.now() - 14000000).toISOString(),
    dealId: 'DEAL-2026-001',
    dealName: 'TechWidget Inc',
    toolsCalled: 5,
    approvalsRequested: 0,
  },
];

// Stats are now calculated dynamically from events and runs

// =============================================================================
// API Handler
// =============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const operatorId = searchParams.get('operatorId');
  const dealId = searchParams.get('dealId');
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  // For now, we use mock data
  // In production, this would fetch from the backend/database

  // Filter events by dealId if provided
  let events = [...MOCK_EVENTS];
  let runs = [...MOCK_RUNS];

  if (dealId) {
    events = events.filter(e => e.dealId === dealId);
    runs = runs.filter(r => r.dealId === dealId);
  }

  // Sort by timestamp (most recent first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  // Limit results
  events = events.slice(0, limit);

  // Determine status (using mock data - no active runs by default)
  const status = determineAgentStatus([], []);

  // Calculate stats from actual data (so they match filtered results)
  const stats: AgentActivityStats = {
    // Count total tools called (based on runs)
    toolsCalledToday: runs.reduce((sum, r) => sum + r.toolsCalled, 0),
    // Count approval events (matches 'approvals' filter)
    approvalsProcessed: events.filter(e => e.type.startsWith('approval.')).length,
    // Count all deal events (matches 'deals' filter)
    dealsAnalyzed: events.filter(e => e.type.startsWith('deal.')).length,
    // Count runs in last 24h
    runsCompleted24h: runs.filter(r => {
      if (!r.completedAt) return false;
      const completedAt = new Date(r.completedAt).getTime();
      const dayAgo = Date.now() - 86400000;
      return completedAt > dayAgo;
    }).length,
  };

  // Build response
  const response: AgentActivityResponse = {
    status,
    lastActivity: events.length > 0 ? {
      label: events[0].label,
      timestamp: events[0].timestamp,
      dealId: events[0].dealId,
    } : null,
    recent: events,
    stats,
    currentRun: undefined, // No active run in mock
    recentRuns: runs,
  };

  return NextResponse.json(response);
}

// =============================================================================
// Simulate Active Run (for demo purposes)
// =============================================================================

// This can be called to simulate an active run
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { action } = body;

  if (action === 'simulate_run') {
    const simulatedRun: AgentCurrentRun = {
      runId: `run-${Date.now()}`,
      threadId: `thread-${Date.now()}`,
      status: 'running',
      progressLabel: 'Analyzing deal financials...',
      startedAt: new Date().toISOString(),
      dealId: 'DEAL-2026-001',
      dealName: 'TechWidget Inc',
    };

    return NextResponse.json({
      success: true,
      currentRun: simulatedRun,
    });
  }

  return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
}
