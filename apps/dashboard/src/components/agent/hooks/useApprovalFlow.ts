/**
 * useApprovalFlow Hook
 *
 * Manages approval actions for agent tool calls.
 * Handles approve, reject, and modify-then-approve flows.
 */

'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  agentQueryKeys,
  agentClient,
  type PendingToolApproval,
} from '@/lib/agent-client';
import type { AgentToolCall } from '@/types/execution-contracts';

// =============================================================================
// Types
// =============================================================================

export interface ApprovalAction {
  toolCallId: string;
  action: 'approve' | 'reject';
  approvedBy: string;
  reason?: string;
  modifications?: Record<string, unknown>;
}

export interface ApprovalResult {
  success: boolean;
  error?: string;
  toolCall?: AgentToolCall;
}

export interface UseApprovalFlowOptions {
  onApprovalSuccess?: (toolCall: AgentToolCall) => void;
  onApprovalError?: (error: string, toolCallId: string) => void;
  onRejectionSuccess?: (toolCall: AgentToolCall) => void;
  onRejectionError?: (error: string, toolCallId: string) => void;
}

export interface ApprovalFlowState {
  pendingApprovals: PendingToolApproval[];
  isLoading: boolean;
  error: Error | null;
  isApproving: boolean;
  isRejecting: boolean;
  currentlyProcessing: string | null;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useApprovalFlow(options: UseApprovalFlowOptions = {}): ApprovalFlowState & {
  approve: (params: {
    threadId: string;
    runId: string;
    toolCallId: string;
    approvedBy: string;
    modifications?: Record<string, unknown>;
  }) => Promise<ApprovalResult>;
  reject: (params: {
    threadId: string;
    runId: string;
    toolCallId: string;
    rejectedBy: string;
    reason?: string;
  }) => Promise<ApprovalResult>;
  refetchApprovals: () => void;
} {
  const {
    onApprovalSuccess,
    onApprovalError,
    onRejectionSuccess,
    onRejectionError,
  } = options;

  const queryClient = useQueryClient();
  const [currentlyProcessing, setCurrentlyProcessing] = useState<string | null>(null);

  // Fetch all pending approvals across all runs
  // NOTE: Polling disabled to prevent UI blinking. Use refetchApprovals() for manual refresh.
  const {
    data: pendingApprovals = [],
    isLoading,
    error,
    refetch: refetchApprovals,
  } = useQuery({
    queryKey: agentQueryKeys.pendingApprovals,
    queryFn: async () => {
      try {
        return await agentClient.getPendingApprovals();
      } catch (err) {
        // Return empty array on 404/error to prevent UI blinking
        console.debug('[Approvals] API not available, returning empty');
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - don't refetch frequently
    refetchInterval: false,   // Disabled - use SSE or manual refresh instead
    refetchOnWindowFocus: false,
    retry: false,             // Don't retry on 404
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (params: {
      threadId: string;
      runId: string;
      toolCallId: string;
      approvedBy: string;
      modifications?: Record<string, unknown>;
    }) => {
      setCurrentlyProcessing(params.toolCallId);
      return agentClient.approveToolCall(
        params.threadId,
        params.runId,
        params.toolCallId,
        params.approvedBy,
        params.modifications
      );
    },
    onSuccess: (result, variables) => {
      setCurrentlyProcessing(null);
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.pendingApprovals,
      });
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.runs.toolCalls(variables.threadId, variables.runId),
      });
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.runs.detail(variables.threadId, variables.runId),
      });
      if (result) {
        onApprovalSuccess?.(result);
      }
    },
    onError: (error: Error, variables) => {
      setCurrentlyProcessing(null);
      onApprovalError?.(error.message, variables.toolCallId);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (params: {
      threadId: string;
      runId: string;
      toolCallId: string;
      rejectedBy: string;
      reason?: string;
    }) => {
      setCurrentlyProcessing(params.toolCallId);
      return agentClient.rejectToolCall(
        params.threadId,
        params.runId,
        params.toolCallId,
        params.rejectedBy,
        params.reason
      );
    },
    onSuccess: (result, variables) => {
      setCurrentlyProcessing(null);
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.pendingApprovals,
      });
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.runs.toolCalls(variables.threadId, variables.runId),
      });
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.runs.detail(variables.threadId, variables.runId),
      });
      if (result) {
        onRejectionSuccess?.(result);
      }
    },
    onError: (error: Error, variables) => {
      setCurrentlyProcessing(null);
      onRejectionError?.(error.message, variables.toolCallId);
    },
  });

  // Approve action
  const approve = useCallback(
    async (params: {
      threadId: string;
      runId: string;
      toolCallId: string;
      approvedBy: string;
      modifications?: Record<string, unknown>;
    }): Promise<ApprovalResult> => {
      try {
        const result = await approveMutation.mutateAsync(params);
        return { success: true, toolCall: result };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to approve',
        };
      }
    },
    [approveMutation]
  );

  // Reject action
  const reject = useCallback(
    async (params: {
      threadId: string;
      runId: string;
      toolCallId: string;
      rejectedBy: string;
      reason?: string;
    }): Promise<ApprovalResult> => {
      try {
        const result = await rejectMutation.mutateAsync(params);
        return { success: true, toolCall: result };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to reject',
        };
      }
    },
    [rejectMutation]
  );

  return {
    pendingApprovals,
    isLoading,
    error: error as Error | null,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    currentlyProcessing,
    approve,
    reject,
    refetchApprovals,
  };
}

// =============================================================================
// Utility Hook: Single Approval Context
// =============================================================================

/**
 * Hook for managing a single approval interaction
 * Useful when building focused approval UI
 */
export function useSingleApproval(toolCall: AgentToolCall | null) {
  const [showModifyDialog, setShowModifyDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [modifiedInputs, setModifiedInputs] = useState<Record<string, unknown>>({});
  const [rejectReason, setRejectReason] = useState('');

  // Reset state when tool call changes
  const reset = useCallback(() => {
    setShowModifyDialog(false);
    setShowRejectDialog(false);
    setModifiedInputs({});
    setRejectReason('');
  }, []);

  // Initialize modified inputs from tool call
  const initializeModifications = useCallback(() => {
    if (toolCall) {
      setModifiedInputs({ ...toolCall.tool_input });
    }
  }, [toolCall]);

  return {
    showModifyDialog,
    setShowModifyDialog,
    showRejectDialog,
    setShowRejectDialog,
    modifiedInputs,
    setModifiedInputs,
    rejectReason,
    setRejectReason,
    reset,
    initializeModifications,
    hasModifications: toolCall
      ? JSON.stringify(modifiedInputs) !== JSON.stringify(toolCall.tool_input)
      : false,
  };
}
