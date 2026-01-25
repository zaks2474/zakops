/**
 * useAgentActivity Hook
 *
 * Single source of truth for all agent visibility components.
 * ALL agent visibility components MUST use this hook - no direct API calls.
 *
 * Features:
 * - Unified data fetching for agent activity
 * - SSE integration for real-time updates
 * - Proper caching and stale time management
 */

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { AgentActivityResponse, AgentStatus, AgentActivityStats } from '@/types/agent-activity';

// =============================================================================
// Types
// =============================================================================

export interface UseAgentActivityOptions {
  /** Optional - server derives from session if not provided */
  operatorId?: string;
  /** Filter to specific deal */
  dealId?: string;
  /** Enable/disable the query */
  enabled?: boolean;
}

// =============================================================================
// Query Key Factory
// =============================================================================

export const agentActivityKeys = {
  all: ['agentActivity'] as const,
  activity: (operatorId?: string, dealId?: string) =>
    [...agentActivityKeys.all, operatorId, dealId] as const,
};

// =============================================================================
// Main Hook
// =============================================================================

export function useAgentActivity({
  operatorId,
  dealId,
  enabled = true,
}: UseAgentActivityOptions = {}) {
  const queryClient = useQueryClient();
  const queryKey = agentActivityKeys.activity(operatorId, dealId);

  // Main query with polling fallback
  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<AgentActivityResponse> => {
      const params = new URLSearchParams();
      if (operatorId) params.append('operatorId', operatorId);
      if (dealId) params.append('dealId', dealId);

      const response = await fetch(`/api/agent/activity?${params}`);
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized');
        }
        throw new Error('Failed to fetch agent activity');
      }
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // 1 minute fallback polling
    enabled,
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error instanceof Error && error.message === 'Unauthorized') {
        return false;
      }
      return failureCount < 2;
    },
  });

  // SSE integration: invalidate query when relevant events arrive
  // This integrates with the existing useRealtimeEvents hook if available
  useEffect(() => {
    // Listen for custom events dispatched by SSE handler
    const handleAgentEvent = (event: CustomEvent) => {
      const eventType = event.detail?.type;
      const agentEvents = [
        'agent.run_started',
        'agent.run_completed',
        'agent.run_failed',
        'agent.tool_called',
        'agent.tool_completed',
        'deal.created',
        'deal.scored',
        'deal.analyzed',
        'deal.stage_changed',
        'approval.requested',
        'approval.approved',
        'approval.rejected',
      ];

      if (agentEvents.includes(eventType)) {
        queryClient.invalidateQueries({ queryKey });
      }
    };

    window.addEventListener('agent-event' as any, handleAgentEvent);
    return () => {
      window.removeEventListener('agent-event' as any, handleAgentEvent);
    };
  }, [queryClient, queryKey]);

  return query;
}

// =============================================================================
// Convenience Selectors
// =============================================================================

/**
 * Get just the agent status
 */
export function useAgentStatus(options: UseAgentActivityOptions = {}): AgentStatus {
  const { data } = useAgentActivity(options);
  return data?.status ?? 'idle';
}

/**
 * Get just the agent stats
 */
export function useAgentStats(options: UseAgentActivityOptions = {}): AgentActivityStats | undefined {
  const { data } = useAgentActivity(options);
  return data?.stats;
}

/**
 * Check if agent has any pending approvals
 */
export function useHasPendingApprovals(options: UseAgentActivityOptions = {}): boolean {
  const { data } = useAgentActivity(options);
  return data?.status === 'waiting_approval';
}

/**
 * Get current run if any
 */
export function useCurrentRun(options: UseAgentActivityOptions = {}) {
  const { data } = useAgentActivity(options);
  return data?.currentRun;
}
