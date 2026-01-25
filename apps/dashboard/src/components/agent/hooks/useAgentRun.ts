/**
 * useAgentRun Hook
 *
 * Manages agent run state with real-time event subscriptions.
 * Provides optimistic updates and automatic cache invalidation.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { agentQueryKeys, agentClient } from '@/lib/agent-client';
import { useRealtimeEvents, type RealtimeEvent } from '@/hooks/use-realtime-events';
import type {
  AgentRun,
  AgentToolCall,
  RunStatus,
} from '@/types/execution-contracts';
import type { RiskLevel } from '@/lib/agent/toolRegistry';

// =============================================================================
// Types
// =============================================================================

export interface AgentRunState {
  run: AgentRun | null;
  status: RunStatus | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | null;
  toolCalls: AgentToolCall[];
  pendingApprovals: AgentToolCall[];
  completedToolCalls: AgentToolCall[];
  failedToolCalls: AgentToolCall[];
  currentThinking: string | null;
  streamTokens: string[];
  progress: RunProgress;
}

export interface RunProgress {
  totalToolCalls: number;
  completedToolCalls: number;
  pendingApprovals: number;
  percentComplete: number;
}

export interface UseAgentRunOptions {
  threadId: string;
  runId: string;
  enabled?: boolean;
  onToolCallStarted?: (toolCall: AgentToolCall) => void;
  onToolCallCompleted?: (toolCall: AgentToolCall) => void;
  onApprovalRequired?: (toolCall: AgentToolCall) => void;
  onRunCompleted?: (run: AgentRun) => void;
  onRunFailed?: (error: string) => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAgentRun(options: UseAgentRunOptions): AgentRunState & {
  refetch: () => void;
  cancelRun: () => Promise<void>;
} {
  const {
    threadId,
    runId,
    enabled = true,
    onToolCallStarted,
    onToolCallCompleted,
    onApprovalRequired,
    onRunCompleted,
    onRunFailed,
  } = options;

  const queryClient = useQueryClient();

  // Local streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentThinking, setCurrentThinking] = useState<string | null>(null);
  const [streamTokens, setStreamTokens] = useState<string[]>([]);

  // Fetch run data
  const {
    data: run,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: agentQueryKeys.runs.detail(threadId, runId),
    queryFn: () => agentClient.getRun(threadId, runId),
    enabled: enabled && !!threadId && !!runId,
    refetchInterval: (query) => {
      // Poll every 2 seconds while running
      const status = query.state.data?.status;
      return status === 'running' || status === 'pending' ? 2000 : false;
    },
  });

  // Fetch tool calls for this run
  const { data: toolCalls = [] } = useQuery({
    queryKey: agentQueryKeys.runs.toolCalls(threadId, runId),
    queryFn: () => agentClient.getToolCalls(threadId, runId),
    enabled: enabled && !!threadId && !!runId,
  });

  // Handle real-time events
  const handleEvent = useCallback(
    (event: RealtimeEvent) => {
      const { eventType, data } = event;

      switch (eventType) {
        case 'stream_start':
          setIsStreaming(true);
          setStreamTokens([]);
          break;

        case 'stream_token':
          if (data.token) {
            setStreamTokens((prev) => [...prev, data.token as string]);
          }
          break;

        case 'stream_end':
          setIsStreaming(false);
          break;

        case 'tool_call_started': {
          const toolCall = data as unknown as AgentToolCall;
          onToolCallStarted?.(toolCall);
          // Invalidate tool calls to get latest
          queryClient.invalidateQueries({
            queryKey: agentQueryKeys.runs.toolCalls(threadId, runId),
          });
          break;
        }

        case 'tool_call_completed': {
          const toolCall = data as unknown as AgentToolCall;
          onToolCallCompleted?.(toolCall);
          queryClient.invalidateQueries({
            queryKey: agentQueryKeys.runs.toolCalls(threadId, runId),
          });
          break;
        }

        case 'tool_approval_required': {
          const toolCall = data as unknown as AgentToolCall;
          onApprovalRequired?.(toolCall);
          queryClient.invalidateQueries({
            queryKey: agentQueryKeys.runs.toolCalls(threadId, runId),
          });
          queryClient.invalidateQueries({
            queryKey: agentQueryKeys.pendingApprovals,
          });
          break;
        }

        case 'run_completed': {
          onRunCompleted?.(data as unknown as AgentRun);
          refetch();
          break;
        }

        case 'run_failed': {
          onRunFailed?.((data as { error?: string }).error || 'Unknown error');
          refetch();
          break;
        }

        default:
          // Handle thinking events or others
          if (eventType === 'thinking' && data.message) {
            setCurrentThinking(data.message as string);
          }
      }
    },
    [
      threadId,
      runId,
      queryClient,
      refetch,
      onToolCallStarted,
      onToolCallCompleted,
      onApprovalRequired,
      onRunCompleted,
      onRunFailed,
    ]
  );

  // Subscribe to real-time events
  const { connected } = useRealtimeEvents({
    threadId,
    runId,
    enabled: enabled && !!threadId && !!runId,
    onEvent: handleEvent,
  });

  // Derived state
  const derivedState = useMemo(() => {
    const pending = toolCalls.filter((tc: AgentToolCall) => tc.status === 'pending' && tc.requires_approval);
    const completed = toolCalls.filter((tc: AgentToolCall) => tc.status === 'completed');
    const failed = toolCalls.filter((tc: AgentToolCall) => tc.status === 'failed');

    const totalCalls = toolCalls.length;
    const completedCount = completed.length;
    const percentComplete = totalCalls > 0 ? (completedCount / totalCalls) * 100 : 0;

    return {
      pendingApprovals: pending,
      completedToolCalls: completed,
      failedToolCalls: failed,
      progress: {
        totalToolCalls: totalCalls,
        completedToolCalls: completedCount,
        pendingApprovals: pending.length,
        percentComplete,
      },
    };
  }, [toolCalls]);

  // Cancel run action
  const cancelRun = useCallback(async () => {
    if (!threadId || !runId) return;
    await agentClient.cancelRun(threadId, runId);
    refetch();
  }, [threadId, runId, refetch]);

  // Clear thinking when run ends
  useEffect(() => {
    if (run?.status === 'completed' || run?.status === 'failed' || run?.status === 'cancelled') {
      setCurrentThinking(null);
      setIsStreaming(false);
    }
  }, [run?.status]);

  return {
    run: run ?? null,
    status: run?.status ?? null,
    isLoading,
    isStreaming,
    error: error as Error | null,
    toolCalls,
    ...derivedState,
    currentThinking,
    streamTokens,
    refetch,
    cancelRun,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get risk level badge color
 */
export function getRiskLevelColor(riskLevel: RiskLevel | 'critical'): string {
  switch (riskLevel) {
    case 'low':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'medium':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    case 'high':
      return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'critical':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  }
}

/**
 * Get status color
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'text-yellow-500';
    case 'running':
      return 'text-blue-500';
    case 'completed':
      return 'text-green-500';
    case 'failed':
      return 'text-red-500';
    case 'cancelled':
      return 'text-gray-500';
    case 'approved':
      return 'text-green-500';
    case 'rejected':
      return 'text-orange-500';
    default:
      return 'text-gray-500';
  }
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
