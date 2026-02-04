/**
 * Agent Activity API Endpoint
 *
 * Proxies activity requests to Agent API /agent/activity endpoint.
 * GET /api/agent/activity?limit=50&offset=0
 *
 * F003-P1-001 + F003-CL-003 Remediation: Now calls real Agent API
 * which queries audit_log table for actual agent activity data.
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  AgentActivityResponse,
  AgentStatus,
  AgentActivityEvent,
  AgentEventType,
} from '@/types/agent-activity';

// Agent API configuration
const AGENT_API_URL = process.env.AGENT_LOCAL_URL || 'http://localhost:8095';
const AGENT_SERVICE_TOKEN = process.env.AGENT_SERVICE_TOKEN || process.env.DASHBOARD_SERVICE_TOKEN;

// Map Agent API event types to dashboard event types
function mapEventType(apiEventType: string): AgentEventType {
  const mapping: Record<string, AgentEventType> = {
    'approval_created': 'approval.requested',
    'approval_claimed': 'agent.run_started',
    'approval_approved': 'approval.approved',
    'approval_rejected': 'approval.rejected',
    'approval_expired': 'approval.rejected',
    'tool_execution_started': 'agent.tool_called',
    'tool_execution_completed': 'agent.tool_completed',
    'tool_execution_failed': 'agent.tool_failed',
    'stale_claim_reclaimed': 'agent.run_started',
  };
  return mapping[apiEventType] || 'agent.run_completed';
}

// Determine agent status from recent events
function determineStatus(events: Array<{ event_type: string }>): AgentStatus {
  if (events.length === 0) return 'idle';

  const recentEvent = events[0]?.event_type;
  if (recentEvent === 'approval_created' || recentEvent === 'approval_claimed') {
    return 'waiting_approval';
  }
  if (recentEvent === 'tool_execution_started') {
    return 'working';
  }
  return 'idle';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get('limit') || '50';
  const offset = searchParams.get('offset') || '0';

  try {
    // Call Agent API /agent/activity
    const agentResponse = await fetch(
      `${AGENT_API_URL}/agent/activity?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': AGENT_SERVICE_TOKEN || '',
        },
        // Don't cache activity data
        cache: 'no-store',
      }
    );

    if (!agentResponse.ok) {
      console.error('Agent API activity fetch failed:', agentResponse.status);
      // Return empty state on error (don't crash dashboard)
      return NextResponse.json(getEmptyResponse());
    }

    const agentData = await agentResponse.json();

    // Transform Agent API response to dashboard format
    const recent: AgentActivityEvent[] = (agentData.events || []).map(
      (event: {
        id: string;
        event_type: string;
        label: string;
        timestamp: string;
        thread_id?: string;
        approval_id?: string;
        tool_execution_id?: string;
        tool_name?: string;
      }) => ({
        id: event.id,
        type: mapEventType(event.event_type),
        label: event.label,
        timestamp: event.timestamp,
        metadata: {
          threadId: event.thread_id,
          approvalId: event.approval_id,
          toolExecutionId: event.tool_execution_id,
          toolName: event.tool_name,
        },
      })
    );

    const stats = agentData.stats || {};

    // Determine current status from recent events
    const status = determineStatus(agentData.events || []);

    // Build last activity from most recent event
    const lastActivity =
      recent.length > 0
        ? {
            label: recent[0].label,
            timestamp: recent[0].timestamp,
            threadId: (recent[0].metadata as Record<string, unknown>)?.threadId as string | undefined,
          }
        : null;

    const response: AgentActivityResponse = {
      status,
      lastActivity,
      recent,
      stats: {
        toolsCalledToday: stats.tool_executions_today || 0,
        approvalsProcessed: stats.approvals_today || 0,
        dealsAnalyzed: 0, // Not tracked in audit_log yet
        runsCompleted24h: stats.events_last_24h || 0,
      },
      currentRun: undefined,
      recentRuns: [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Agent activity fetch error:', error);
    // Return empty state on error (don't crash dashboard)
    return NextResponse.json(getEmptyResponse());
  }
}

function getEmptyResponse(): AgentActivityResponse {
  return {
    status: 'idle',
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
}

export async function POST() {
  return NextResponse.json(
    { error: 'not_implemented', message: 'Agent run simulation not available' },
    { status: 501 }
  );
}
