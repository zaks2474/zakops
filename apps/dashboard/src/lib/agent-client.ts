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
    queryFn: () => apiFetch<AgentThread>(`/api/threads/${threadId}`),
    enabled: !!threadId,
    ...options,
  });
}

export function useCreateThread(
  options?: UseMutationOptions<AgentThread, Error, ThreadCreateRequest>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ThreadCreateRequest) =>
      apiFetch<AgentThread>('/api/threads', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
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
    mutationFn: (threadId: string) =>
      apiFetch<{ status: string; thread_id: string }>(`/api/threads/${threadId}`, {
        method: 'DELETE',
      }),
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
    queryFn: () =>
      apiFetch<AgentRun[]>(`/api/threads/${threadId}/runs${qs ? `?${qs}` : ''}`),
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
    queryFn: () => apiFetch<AgentRun>(`/api/threads/${threadId}/runs/${runId}`),
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
    mutationFn: (data: RunCreateRequest) =>
      apiFetch<AgentRun>(`/api/threads/${threadId}/runs`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
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
    queryFn: () =>
      apiFetch<AgentEvent[]>(
        `/api/threads/${threadId}/runs/${runId}/events${qs ? `?${qs}` : ''}`
      ),
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
    queryFn: () =>
      apiFetch<AgentToolCall[]>(`/api/threads/${threadId}/runs/${runId}/tool_calls`),
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
    queryFn: () =>
      apiFetch<AgentToolCall>(
        `/api/threads/${threadId}/runs/${runId}/tool_calls/${toolCallId}`
      ),
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
    mutationFn: ({ toolCallId, data }) =>
      apiFetch<AgentToolCall>(
        `/api/threads/${threadId}/runs/${runId}/tool_calls/${toolCallId}/approve`,
        {
          method: 'POST',
          body: JSON.stringify(data || {}),
        }
      ),
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
    mutationFn: ({ toolCallId, data }) =>
      apiFetch<AgentToolCall>(
        `/api/threads/${threadId}/runs/${runId}/tool_calls/${toolCallId}/reject`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),
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
    queryFn: async () => {
      try {
        return await apiFetch<PendingToolApproval[]>(
          `/api/pending-tool-approvals${qs ? `?${qs}` : ''}`
        );
      } catch {
        // Return empty array if API not available
        return [];
      }
    },
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
export function streamRunEvents(options: StreamRunOptions): AbortController {
  const { threadId, runId, lastEventId, onEvent, onError, onClose } = options;

  const controller = new AbortController();

  const url = new URL(
    `${API_BASE_URL}/api/threads/${threadId}/runs/${runId}/stream`
  );
  if (lastEventId) {
    url.searchParams.set('Last-Event-ID', lastEventId);
  }

  fetch(url.toString(), {
    signal: controller.signal,
    headers: {
      Accept: 'text/event-stream',
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          onClose?.();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent: {
          eventId?: string;
          eventType?: string;
          data?: string;
        } = {};

        for (const line of lines) {
          if (line.startsWith('id: ')) {
            currentEvent.eventId = line.slice(4);
          } else if (line.startsWith('event: ')) {
            currentEvent.eventType = line.slice(7);
          } else if (line.startsWith('data: ')) {
            currentEvent.data = line.slice(6);
          } else if (line === '' && currentEvent.eventType && currentEvent.data) {
            // End of event
            try {
              onEvent({
                eventId: currentEvent.eventId || '',
                eventType: currentEvent.eventType,
                data: JSON.parse(currentEvent.data),
              });
            } catch (e) {
              console.error('Failed to parse SSE event:', e);
            }
            currentEvent = {};
          }
        }
      }
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        onError?.(error);
      }
    });

  return controller;
}

/**
 * Create and stream a new run.
 * Returns an AbortController to cancel the stream.
 */
export function createAndStreamRun(
  threadId: string,
  data: RunCreateRequest,
  options: Omit<StreamRunOptions, 'threadId' | 'runId'>
): AbortController {
  const controller = new AbortController();

  const url = `${API_BASE_URL}/api/threads/${threadId}/runs/stream`;

  fetch(url, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(data),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          options.onClose?.();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent: {
          eventId?: string;
          eventType?: string;
          data?: string;
        } = {};

        for (const line of lines) {
          if (line.startsWith('id: ')) {
            currentEvent.eventId = line.slice(4);
          } else if (line.startsWith('event: ')) {
            currentEvent.eventType = line.slice(7);
          } else if (line.startsWith('data: ')) {
            currentEvent.data = line.slice(6);
          } else if (line === '' && currentEvent.eventType && currentEvent.data) {
            try {
              options.onEvent({
                eventId: currentEvent.eventId || '',
                eventType: currentEvent.eventType,
                data: JSON.parse(currentEvent.data),
              });
            } catch (e) {
              console.error('Failed to parse SSE event:', e);
            }
            currentEvent = {};
          }
        }
      }
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        options.onError?.(error);
      }
    });

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
  // Thread operations
  getThread: (threadId: string) =>
    apiFetch<AgentThread>(`/api/threads/${threadId}`),

  createThread: (data: ThreadCreateRequest) =>
    apiFetch<AgentThread>('/api/threads', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  archiveThread: (threadId: string) =>
    apiFetch<{ status: string; thread_id: string }>(`/api/threads/${threadId}`, {
      method: 'DELETE',
    }),

  // Run operations
  getRuns: (threadId: string, params?: { status?: RunStatus; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const qs = searchParams.toString();
    return apiFetch<AgentRun[]>(`/api/threads/${threadId}/runs${qs ? `?${qs}` : ''}`);
  },

  getRun: (threadId: string, runId: string) =>
    apiFetch<AgentRun>(`/api/threads/${threadId}/runs/${runId}`),

  createRun: (threadId: string, data: RunCreateRequest) =>
    apiFetch<AgentRun>(`/api/threads/${threadId}/runs`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancelRun: (threadId: string, runId: string) =>
    apiFetch<AgentRun>(`/api/threads/${threadId}/runs/${runId}/cancel`, {
      method: 'POST',
    }),

  // Run events
  getRunEvents: (
    threadId: string,
    runId: string,
    params?: { last_event_id?: string; limit?: number }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.last_event_id) searchParams.append('last_event_id', params.last_event_id);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const qs = searchParams.toString();
    return apiFetch<AgentEvent[]>(
      `/api/threads/${threadId}/runs/${runId}/events${qs ? `?${qs}` : ''}`
    );
  },

  // Tool call operations
  getToolCalls: (threadId: string, runId: string) =>
    apiFetch<AgentToolCall[]>(`/api/threads/${threadId}/runs/${runId}/tool_calls`),

  getToolCall: (threadId: string, runId: string, toolCallId: string) =>
    apiFetch<AgentToolCall>(
      `/api/threads/${threadId}/runs/${runId}/tool_calls/${toolCallId}`
    ),

  approveToolCall: (
    threadId: string,
    runId: string,
    toolCallId: string,
    approvedBy?: string,
    modifications?: Record<string, unknown>
  ) =>
    apiFetch<AgentToolCall>(
      `/api/threads/${threadId}/runs/${runId}/tool_calls/${toolCallId}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ approved_by: approvedBy, modifications }),
      }
    ),

  rejectToolCall: (
    threadId: string,
    runId: string,
    toolCallId: string,
    rejectedBy?: string,
    reason?: string
  ) =>
    apiFetch<AgentToolCall>(
      `/api/threads/${threadId}/runs/${runId}/tool_calls/${toolCallId}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ rejected_by: rejectedBy, reason }),
      }
    ),

  // Pending approvals
  getPendingApprovals: (params?: { limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const qs = searchParams.toString();
    return apiFetch<PendingToolApproval[]>(
      `/api/pending-tool-approvals${qs ? `?${qs}` : ''}`
    );
  },

  // Message operations (for chat)
  sendMessage: (threadId: string, message: string, assistantId?: string) =>
    apiFetch<AgentRun>(`/api/threads/${threadId}/runs`, {
      method: 'POST',
      body: JSON.stringify({
        input_message: message,
        assistant_id: assistantId,
        stream: true,
      }),
    }),
};

export type AgentClient = typeof agentClient;
