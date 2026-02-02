/**
 * ZakOps Agent API Client
 * React Query hooks for agent thread/run management
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import type {
  AgentThread,
  AgentRun,
  AgentToolCall,
  AgentEvent,
  ThreadStatus,
  RunStatus,
} from '@/types/execution-contracts';

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is required (e.g., http://localhost:8091)');
}

// =============================================================================
// FETCH HELPER
// =============================================================================

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// TYPES
// =============================================================================

export interface ThreadCreateRequest {
  assistant_id: string;
  deal_id?: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
  user_context?: Record<string, unknown>;
}

export interface RunCreateRequest {
  input_message: string;
  assistant_id?: string;
  metadata?: Record<string, unknown>;
  stream?: boolean;
}

export interface ToolCallApproveRequest {
  approved_by?: string;
}

export interface ToolCallRejectRequest {
  rejected_by?: string;
  reason: string;
}

export interface PendingToolApproval {
  tool_call_id: string;
  run_id: string;
  thread_id: string;
  deal_id: string | null;
  deal_name: string | null;
  tool_name: string;
  tool_input: Record<string, unknown>;
  risk_level: string;
  created_at: string;
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const agentQueryKeys = {
  threads: {
    all: ['agent', 'threads'] as const,
    detail: (id: string) => ['agent', 'threads', id] as const,
    runs: (threadId: string) => ['agent', 'threads', threadId, 'runs'] as const,
  },
  runs: {
    detail: (threadId: string, runId: string) =>
      ['agent', 'threads', threadId, 'runs', runId] as const,
    events: (threadId: string, runId: string) =>
      ['agent', 'threads', threadId, 'runs', runId, 'events'] as const,
    toolCalls: (threadId: string, runId: string) =>
      ['agent', 'threads', threadId, 'runs', runId, 'tool_calls'] as const,
  },
  toolCalls: {
    detail: (threadId: string, runId: string, toolCallId: string) =>
      ['agent', 'threads', threadId, 'runs', runId, 'tool_calls', toolCallId] as const,
  },
  pendingApprovals: ['agent', 'pending-approvals'] as const,
};

// =============================================================================
// THREAD HOOKS
// =============================================================================

export function useThread(
  threadId: string,
  options?: Omit<UseQueryOptions<AgentThread>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: agentQueryKeys.threads.detail(threadId),
    queryFn: async () => null as unknown as AgentThread,
    enabled: !!threadId,
    ...options,
  });
}

export function useCreateThread(
  options?: UseMutationOptions<AgentThread, Error, ThreadCreateRequest>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_data: ThreadCreateRequest) => null as unknown as AgentThread,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.threads.all });
    },
    ...options,
  });
}

export function useArchiveThread(
  options?: UseMutationOptions<{ status: string; thread_id: string }, Error, string>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_threadId: string) => null as unknown as { status: string; thread_id: string },
    onSuccess: (_, threadId) => {
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.threads.all });
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.threads.detail(threadId) });
    },
    ...options,
  });
}

// =============================================================================
// RUN HOOKS
// =============================================================================

export function useRuns(
  threadId: string,
  params?: { status?: RunStatus; limit?: number },
  options?: Omit<UseQueryOptions<AgentRun[]>, 'queryKey' | 'queryFn'>
) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append('status', params.status);
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  const qs = searchParams.toString();

  return useQuery({
    queryKey: agentQueryKeys.threads.runs(threadId),
    queryFn: async () => [] as AgentRun[],
    enabled: !!threadId,
    ...options,
  });
}

export function useRun(
  threadId: string,
  runId: string,
  options?: Omit<UseQueryOptions<AgentRun>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: agentQueryKeys.runs.detail(threadId, runId),
    queryFn: async () => null as unknown as AgentRun,
    enabled: !!threadId && !!runId,
    ...options,
  });
}

export function useCreateRun(
  threadId: string,
  options?: UseMutationOptions<AgentRun, Error, RunCreateRequest>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_data: RunCreateRequest) => null as unknown as AgentRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.threads.runs(threadId) });
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.threads.detail(threadId) });
    },
    ...options,
  });
}

export function useRunEvents(
  threadId: string,
  runId: string,
  params?: { last_event_id?: string; limit?: number },
  options?: Omit<UseQueryOptions<AgentEvent[]>, 'queryKey' | 'queryFn'>
) {
  const searchParams = new URLSearchParams();
  if (params?.last_event_id) searchParams.append('last_event_id', params.last_event_id);
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  const qs = searchParams.toString();

  return useQuery({
    queryKey: agentQueryKeys.runs.events(threadId, runId),
    queryFn: async () => [] as AgentEvent[],
    enabled: !!threadId && !!runId,
    ...options,
  });
}

// =============================================================================
// TOOL CALL HOOKS
// =============================================================================

export function useToolCalls(
  threadId: string,
  runId: string,
  options?: Omit<UseQueryOptions<AgentToolCall[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: agentQueryKeys.runs.toolCalls(threadId, runId),
    queryFn: async () => [] as AgentToolCall[],
    enabled: !!threadId && !!runId,
    ...options,
  });
}

export function useToolCall(
  threadId: string,
  runId: string,
  toolCallId: string,
  options?: Omit<UseQueryOptions<AgentToolCall>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: agentQueryKeys.toolCalls.detail(threadId, runId, toolCallId),
    queryFn: async () => null as unknown as AgentToolCall,
    enabled: !!threadId && !!runId && !!toolCallId,
    ...options,
  });
}

export function useApproveToolCall(
  threadId: string,
  runId: string,
  options?: UseMutationOptions<
    AgentToolCall,
    Error,
    { toolCallId: string; data?: ToolCallApproveRequest }
  >
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ toolCallId: _toolCallId, data: _data }) => null as unknown as AgentToolCall,
    onSuccess: (_, { toolCallId }) => {
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.runs.toolCalls(threadId, runId),
      });
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.toolCalls.detail(threadId, runId, toolCallId),
      });
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.pendingApprovals });
    },
    ...options,
  });
}

export function useRejectToolCall(
  threadId: string,
  runId: string,
  options?: UseMutationOptions<
    AgentToolCall,
    Error,
    { toolCallId: string; data: ToolCallRejectRequest }
  >
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ toolCallId: _toolCallId, data: _data }) => null as unknown as AgentToolCall,
    onSuccess: (_, { toolCallId }) => {
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.runs.toolCalls(threadId, runId),
      });
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.toolCalls.detail(threadId, runId, toolCallId),
      });
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.pendingApprovals });
    },
    ...options,
  });
}

// =============================================================================
// PENDING APPROVALS
// =============================================================================

export function usePendingToolApprovals(
  params?: { limit?: number },
  options?: Omit<UseQueryOptions<PendingToolApproval[]>, 'queryKey' | 'queryFn'>
) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  const qs = searchParams.toString();

  return useQuery({
    queryKey: agentQueryKeys.pendingApprovals,
    queryFn: async () => [] as PendingToolApproval[],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false,   // Disabled to prevent UI blinking
    refetchOnWindowFocus: false,
    retry: false,
    ...options,
  });
}

// =============================================================================
// SSE STREAMING
// =============================================================================

export interface StreamRunOptions {
  threadId: string;
  runId: string;
  lastEventId?: string;
  onEvent: (event: {
    eventId: string;
    eventType: string;
    data: Record<string, unknown>;
  }) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

/**
 * Create an SSE connection to stream run events.
 * Returns an AbortController to cancel the stream.
 */
export function streamRunEvents(_options: StreamRunOptions): AbortController {
  // Stubbed: thread endpoints do not exist on the backend
  const controller = new AbortController();
  setTimeout(() => _options.onClose?.(), 0);
  return controller;
}

/**
 * Create and stream a new run.
 * Returns an AbortController to cancel the stream.
 */
export function createAndStreamRun(
  _threadId: string,
  _data: RunCreateRequest,
  options: Omit<StreamRunOptions, 'threadId' | 'runId'>
): AbortController {
  // Stubbed: thread endpoints do not exist on the backend
  const controller = new AbortController();
  setTimeout(() => options.onClose?.(), 0);
  return controller;
}

// =============================================================================
// AGENT CLIENT OBJECT (for non-hook usage)
// =============================================================================

/**
 * Standalone agent API client for use outside React components
 * or when hooks aren't suitable.
 */
export const agentClient = {
  // Thread operations (stubbed: thread endpoints do not exist on the backend)
  getThread: (_threadId: string) =>
    Promise.resolve(null as unknown as AgentThread),

  createThread: (_data: ThreadCreateRequest) =>
    Promise.resolve(null as unknown as AgentThread),

  archiveThread: (_threadId: string) =>
    Promise.resolve(null as unknown as { status: string; thread_id: string }),

  // Run operations (stubbed)
  getRuns: (_threadId: string, _params?: { status?: RunStatus; limit?: number }) =>
    Promise.resolve([] as AgentRun[]),

  getRun: (_threadId: string, _runId: string) =>
    Promise.resolve(null as unknown as AgentRun),

  createRun: (_threadId: string, _data: RunCreateRequest) =>
    Promise.resolve(null as unknown as AgentRun),

  cancelRun: (_threadId: string, _runId: string) =>
    Promise.resolve(null as unknown as AgentRun),

  // Run events (stubbed)
  getRunEvents: (
    _threadId: string,
    _runId: string,
    _params?: { last_event_id?: string; limit?: number }
  ) => Promise.resolve([] as AgentEvent[]),

  // Tool call operations (stubbed)
  getToolCalls: (_threadId: string, _runId: string) =>
    Promise.resolve([] as AgentToolCall[]),

  getToolCall: (_threadId: string, _runId: string, _toolCallId: string) =>
    Promise.resolve(null as unknown as AgentToolCall),

  approveToolCall: (
    _threadId: string,
    _runId: string,
    _toolCallId: string,
    _approvedBy?: string,
    _modifications?: Record<string, unknown>
  ) => Promise.resolve(null as unknown as AgentToolCall),

  rejectToolCall: (
    _threadId: string,
    _runId: string,
    _toolCallId: string,
    _rejectedBy?: string,
    _reason?: string
  ) => Promise.resolve(null as unknown as AgentToolCall),

  // Pending approvals (stubbed)
  getPendingApprovals: (_params?: { limit?: number }) =>
    Promise.resolve([] as PendingToolApproval[]),

  // Message operations (stubbed)
  sendMessage: (_threadId: string, _message: string, _assistantId?: string) =>
    Promise.resolve(null as unknown as AgentRun),
};

export type AgentClient = typeof agentClient;
