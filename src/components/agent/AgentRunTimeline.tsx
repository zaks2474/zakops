/**
 * AgentRunTimeline Component
 *
 * Vertical timeline showing the progression of an agent run:
 * - Run started
 * - Thinking/reasoning phases
 * - Tool calls with risk indicators
 * - Approval checkpoints
 * - Run completed/failed
 */

'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  IconPlayerPlay,
  IconCheck,
  IconX,
  IconClock,
  IconLoader2,
  IconShieldCheck,
  IconAlertTriangle,
  IconBrain,
  IconTool,
} from '@tabler/icons-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { AgentRun, AgentToolCall, RunStatus } from '@/types/execution-contracts';
import { getToolDefinition, type RiskLevel } from '@/lib/agent/toolRegistry';
import { ToolCallCard } from './ToolCallCard';
import { ApprovalCheckpoint } from './ApprovalCheckpoint';
import { getRiskLevelColor } from './hooks/useAgentRun';

// =============================================================================
// Types
// =============================================================================

interface TimelineEvent {
  id: string;
  type: 'run_started' | 'thinking' | 'tool_call' | 'approval' | 'run_completed' | 'run_failed';
  timestamp: Date;
  data?: {
    run?: AgentRun;
    toolCall?: AgentToolCall;
    message?: string;
    error?: string;
  };
}

interface AgentRunTimelineProps {
  run: AgentRun | null;
  toolCalls: AgentToolCall[];
  currentThinking?: string | null;
  isStreaming?: boolean;
  threadId: string;
  onApprove?: (params: {
    toolCallId: string;
    approvedBy: string;
    modifications?: Record<string, unknown>;
  }) => Promise<{ success: boolean; error?: string }>;
  onReject?: (params: {
    toolCallId: string;
    rejectedBy: string;
    reason?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  operatorId?: string;
  isProcessing?: boolean;
  className?: string;
}

// =============================================================================
// Status Icon Mapping
// =============================================================================

const STATUS_ICONS: Record<RunStatus, typeof IconClock> = {
  pending: IconClock,
  running: IconLoader2,
  completed: IconCheck,
  failed: IconX,
  cancelled: IconX,
};

const STATUS_COLORS: Record<RunStatus, string> = {
  pending: 'text-yellow-500 bg-yellow-500/20',
  running: 'text-blue-500 bg-blue-500/20',
  completed: 'text-green-500 bg-green-500/20',
  failed: 'text-red-500 bg-red-500/20',
  cancelled: 'text-gray-500 bg-gray-500/20',
};

// =============================================================================
// Component
// =============================================================================

export function AgentRunTimeline({
  run,
  toolCalls,
  currentThinking,
  isStreaming = false,
  threadId,
  onApprove,
  onReject,
  operatorId = 'operator',
  isProcessing = false,
  className = '',
}: AgentRunTimelineProps) {
  // Build timeline events from run and tool calls
  const events = useMemo(() => {
    const timeline: TimelineEvent[] = [];

    // Run started event
    if (run?.started_at) {
      timeline.push({
        id: 'run_started',
        type: 'run_started',
        timestamp: new Date(run.started_at),
        data: { run },
      });
    } else if (run?.created_at) {
      timeline.push({
        id: 'run_created',
        type: 'run_started',
        timestamp: new Date(run.created_at),
        data: { run },
      });
    }

    // Tool call events
    for (const tc of toolCalls) {
      const isPendingApproval = tc.status === 'pending' && tc.requires_approval;

      timeline.push({
        id: tc.tool_call_id,
        type: isPendingApproval ? 'approval' : 'tool_call',
        timestamp: new Date(tc.created_at),
        data: { toolCall: tc },
      });
    }

    // Run completed/failed event
    if (run?.completed_at && (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled')) {
      timeline.push({
        id: 'run_ended',
        type: run.status === 'completed' ? 'run_completed' : 'run_failed',
        timestamp: new Date(run.completed_at),
        data: { run, error: run.error || undefined },
      });
    }

    // Sort by timestamp
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return timeline;
  }, [run, toolCalls]);

  if (!run && events.length === 0) {
    return (
      <div className={`text-center text-muted-foreground py-8 ${className}`}>
        No agent activity yet
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      {/* Events */}
      <div className="space-y-4">
        {events.map((event, index) => (
          <TimelineEventItem
            key={event.id}
            event={event}
            isLast={index === events.length - 1}
            threadId={threadId}
            runId={run?.run_id || ''}
            onApprove={onApprove}
            onReject={onReject}
            operatorId={operatorId}
            isProcessing={isProcessing}
          />
        ))}

        {/* Current thinking indicator */}
        {(isStreaming || currentThinking) && run?.status === 'running' && (
          <div className="relative pl-10">
            {/* Timeline dot */}
            <div className="absolute left-2.5 w-3 h-3 bg-blue-500 rounded-full ring-4 ring-background animate-pulse" />

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconBrain className="w-4 h-4 text-blue-500" />
              <span>{currentThinking || 'Thinking...'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Timeline Event Item
// =============================================================================

interface TimelineEventItemProps {
  event: TimelineEvent;
  isLast: boolean;
  threadId: string;
  runId: string;
  onApprove?: (params: {
    toolCallId: string;
    approvedBy: string;
    modifications?: Record<string, unknown>;
  }) => Promise<{ success: boolean; error?: string }>;
  onReject?: (params: {
    toolCallId: string;
    rejectedBy: string;
    reason?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  operatorId: string;
  isProcessing: boolean;
}

function TimelineEventItem({
  event,
  isLast,
  threadId,
  runId,
  onApprove,
  onReject,
  operatorId,
  isProcessing,
}: TimelineEventItemProps) {
  const renderContent = () => {
    switch (event.type) {
      case 'run_started': {
        const run = event.data?.run;
        const StatusIcon = run ? STATUS_ICONS[run.status] : IconPlayerPlay;
        const statusColor = run ? STATUS_COLORS[run.status] : 'text-blue-500 bg-blue-500/20';

        return (
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-full ${statusColor}`}>
              <StatusIcon className={`w-4 h-4 ${run?.status === 'running' ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <p className="text-sm font-medium">
                {run?.status === 'running' ? 'Run in progress' : 'Run started'}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(event.timestamp, 'HH:mm:ss')}
              </p>
            </div>
          </div>
        );
      }

      case 'tool_call': {
        const toolCall = event.data?.toolCall;
        if (!toolCall) return null;

        return (
          <ToolCallCard
            toolCall={toolCall}
            compact
            showApprovalActions={false}
          />
        );
      }

      case 'approval': {
        const toolCall = event.data?.toolCall;
        if (!toolCall) return null;

        return (
          <ApprovalCheckpoint
            toolCall={toolCall}
            threadId={threadId}
            runId={runId}
            onApprove={async (params) => {
              if (!onApprove) return { success: false, error: 'No handler' };
              return onApprove(params);
            }}
            onReject={async (params) => {
              if (!onReject) return { success: false, error: 'No handler' };
              return onReject(params);
            }}
            operatorId={operatorId}
            isProcessing={isProcessing}
          />
        );
      }

      case 'run_completed': {
        return (
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-full bg-green-500/20">
              <IconCheck className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-500">Run completed</p>
              <p className="text-xs text-muted-foreground">
                {format(event.timestamp, 'HH:mm:ss')} - {formatDistanceToNow(event.timestamp, { addSuffix: true })}
              </p>
            </div>
          </div>
        );
      }

      case 'run_failed': {
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-full bg-red-500/20">
                <IconAlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-500">Run failed</p>
                <p className="text-xs text-muted-foreground">
                  {format(event.timestamp, 'HH:mm:ss')}
                </p>
              </div>
            </div>
            {event.data?.error && (
              <div className="ml-10 p-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500">
                {event.data.error}
              </div>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  // Get dot color based on event type
  const getDotColor = () => {
    switch (event.type) {
      case 'run_started':
        return 'bg-blue-500';
      case 'run_completed':
        return 'bg-green-500';
      case 'run_failed':
        return 'bg-red-500';
      case 'approval':
        return 'bg-amber-500';
      case 'tool_call': {
        const toolCall = event.data?.toolCall;
        if (toolCall) {
          const toolDef = getToolDefinition(toolCall.tool_name);
          const riskLevel = toolDef?.riskLevel ?? 'high';
          switch (riskLevel) {
            case 'low':
              return 'bg-green-500';
            case 'medium':
              return 'bg-yellow-500';
            case 'high':
              return 'bg-orange-500';
            default:
              return 'bg-red-500';
          }
        }
        return 'bg-gray-500';
      }
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="relative pl-10">
      {/* Timeline dot */}
      <div
        className={`absolute left-2.5 w-3 h-3 rounded-full ring-4 ring-background ${getDotColor()}`}
      />

      {/* Event content */}
      {renderContent()}
    </div>
  );
}

export default AgentRunTimeline;
