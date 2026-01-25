/**
 * ZakOps Orchestration API Client
 * React Query hooks for data fetching and mutations
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import type {
  Deal,
  DealCreate,
  DealUpdate,
  DealEvent,
  DealAlias,
  DealListParams,
  Action,
  ActionListParams,
  ActionApprove,
  ActionReject,
  ApprovalResponse,
  QuarantineItem,
  QuarantineListParams,
  QuarantineProcess,
  QuarantineProcessResponse,
  SenderProfile,
  SenderListParams,
  PipelineStageSummary,
  PipelineStats,
  HealthResponse,
  StageTransitionRequest,
  StageTransitionResponse,
  StageSummary,
} from '@/types/api';

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9200';

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

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const queryKeys = {
  health: ['health'] as const,
  deals: {
    all: ['deals'] as const,
    list: (params: DealListParams) => ['deals', 'list', params] as const,
    detail: (id: string) => ['deals', 'detail', id] as const,
    events: (id: string) => ['deals', 'events', id] as const,
    aliases: (id: string) => ['deals', 'aliases', id] as const,
  },
  actions: {
    all: ['actions'] as const,
    list: (params: ActionListParams) => ['actions', 'list', params] as const,
    detail: (id: string) => ['actions', 'detail', id] as const,
  },
  quarantine: {
    all: ['quarantine'] as const,
    list: (params: QuarantineListParams) => ['quarantine', 'list', params] as const,
    detail: (id: string) => ['quarantine', 'detail', id] as const,
  },
  senders: {
    all: ['senders'] as const,
    list: (params: SenderListParams) => ['senders', 'list', params] as const,
    detail: (email: string) => ['senders', 'detail', email] as const,
  },
  pipeline: {
    summary: ['pipeline', 'summary'] as const,
    stats: ['pipeline', 'stats'] as const,
  },
};

// =============================================================================
// HEALTH
// =============================================================================

export function useHealth(
  options?: Omit<UseQueryOptions<HealthResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiFetch<HealthResponse>('/health'),
    staleTime: 5000,
    ...options,
  });
}

// =============================================================================
// DEALS
// =============================================================================

export function useDeals(
  params: DealListParams = {},
  options?: Omit<UseQueryOptions<Deal[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.deals.list(params),
    queryFn: () => apiFetch<Deal[]>(`/api/deals${buildQueryString(params)}`),
    staleTime: 30000,
    ...options,
  });
}

export function useDeal(
  dealId: string,
  options?: Omit<UseQueryOptions<Deal>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.deals.detail(dealId),
    queryFn: () => apiFetch<Deal>(`/api/deals/${dealId}`),
    enabled: !!dealId,
    ...options,
  });
}

export function useDealEvents(
  dealId: string,
  limit: number = 50,
  options?: Omit<UseQueryOptions<DealEvent[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.deals.events(dealId),
    queryFn: () => apiFetch<DealEvent[]>(`/api/deals/${dealId}/events?limit=${limit}`),
    enabled: !!dealId,
    ...options,
  });
}

export function useDealAliases(
  dealId: string,
  options?: Omit<UseQueryOptions<DealAlias[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.deals.aliases(dealId),
    queryFn: () => apiFetch<DealAlias[]>(`/api/deals/${dealId}/aliases`),
    enabled: !!dealId,
    ...options,
  });
}

export function useCreateDeal(
  options?: UseMutationOptions<Deal, Error, DealCreate>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DealCreate) =>
      apiFetch<Deal>('/api/deals', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.summary });
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.stats });
    },
    ...options,
  });
}

export function useUpdateDeal(
  options?: UseMutationOptions<Deal, Error, { dealId: string; data: DealUpdate }>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, data }: { dealId: string; data: DealUpdate }) =>
      apiFetch<Deal>(`/api/deals/${dealId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { dealId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.summary });
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.stats });
    },
    ...options,
  });
}

export function useTransitionDeal(
  options?: UseMutationOptions<StageTransitionResponse, Error, { dealId: string; data: StageTransitionRequest; idempotencyKey?: string }>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, data, idempotencyKey }: { dealId: string; data: StageTransitionRequest; idempotencyKey?: string }) =>
      apiFetch<StageTransitionResponse>(`/api/deals/${dealId}/transition`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {},
      }),
    onSuccess: (_, { dealId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.summary });
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.stats });
      queryClient.invalidateQueries({ queryKey: ['deals', 'byStage'] });
    },
    ...options,
  });
}

export function useDealsByStage(
  options?: Omit<UseQueryOptions<StageSummary[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['deals', 'byStage'],
    queryFn: () => apiFetch<StageSummary[]>('/api/deals/stages/summary'),
    staleTime: 30000,
    ...options,
  });
}

// =============================================================================
// ACTIONS
// =============================================================================

export function useActions(
  params: ActionListParams = {},
  options?: Omit<UseQueryOptions<Action[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.actions.list(params),
    queryFn: () => apiFetch<Action[]>(`/api/actions${buildQueryString(params)}`),
    staleTime: 10000,
    ...options,
  });
}

export function usePendingActions(
  options?: Omit<UseQueryOptions<Action[]>, 'queryKey' | 'queryFn'>
) {
  return useActions({ pending_only: true }, options);
}

export function useAction(
  actionId: string,
  options?: Omit<UseQueryOptions<Action>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.actions.detail(actionId),
    queryFn: () => apiFetch<Action>(`/api/actions/${actionId}`),
    enabled: !!actionId,
    ...options,
  });
}

export function useApproveAction(
  options?: UseMutationOptions<ApprovalResponse, Error, { actionId: string; data?: ActionApprove }>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, data }: { actionId: string; data?: ActionApprove }) =>
      apiFetch<ApprovalResponse>(`/api/actions/${actionId}/approve`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }),
    onSuccess: (_, { actionId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.actions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.actions.detail(actionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.stats });
    },
    ...options,
  });
}

export function useRejectAction(
  options?: UseMutationOptions<ApprovalResponse, Error, { actionId: string; data: ActionReject }>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, data }: { actionId: string; data: ActionReject }) =>
      apiFetch<ApprovalResponse>(`/api/actions/${actionId}/reject`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { actionId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.actions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.actions.detail(actionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.stats });
    },
    ...options,
  });
}

// =============================================================================
// QUARANTINE
// =============================================================================

export function useQuarantine(
  params: QuarantineListParams = {},
  options?: Omit<UseQueryOptions<QuarantineItem[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.quarantine.list(params),
    queryFn: () => apiFetch<QuarantineItem[]>(`/api/quarantine${buildQueryString(params)}`),
    staleTime: 30000,
    ...options,
  });
}

export function usePendingQuarantine(
  options?: Omit<UseQueryOptions<QuarantineItem[]>, 'queryKey' | 'queryFn'>
) {
  return useQuarantine({ status: 'pending' }, options);
}

export function useQuarantineItem(
  itemId: string,
  options?: Omit<UseQueryOptions<QuarantineItem>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.quarantine.detail(itemId),
    queryFn: () => apiFetch<QuarantineItem>(`/api/quarantine/${itemId}`),
    enabled: !!itemId,
    ...options,
  });
}

export function useProcessQuarantine(
  options?: UseMutationOptions<QuarantineProcessResponse, Error, { itemId: string; data: QuarantineProcess }>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: QuarantineProcess }) =>
      apiFetch<QuarantineProcessResponse>(`/api/quarantine/${itemId}/process`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { itemId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quarantine.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.quarantine.detail(itemId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.stats });
      // If a deal was created, also refresh deals
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
    },
    ...options,
  });
}

// =============================================================================
// SENDERS
// =============================================================================

export function useSenders(
  params: SenderListParams = {},
  options?: Omit<UseQueryOptions<SenderProfile[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.senders.list(params),
    queryFn: () => apiFetch<SenderProfile[]>(`/api/senders${buildQueryString(params)}`),
    staleTime: 60000,
    ...options,
  });
}

export function useBrokers(
  options?: Omit<UseQueryOptions<SenderProfile[]>, 'queryKey' | 'queryFn'>
) {
  return useSenders({ is_broker: true }, options);
}

export function useSender(
  email: string,
  options?: Omit<UseQueryOptions<SenderProfile>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.senders.detail(email),
    queryFn: () => apiFetch<SenderProfile>(`/api/senders/${encodeURIComponent(email)}`),
    enabled: !!email,
    ...options,
  });
}

// =============================================================================
// PIPELINE
// =============================================================================

export function usePipelineSummary(
  options?: Omit<UseQueryOptions<PipelineStageSummary[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.pipeline.summary,
    queryFn: () => apiFetch<PipelineStageSummary[]>('/api/pipeline/summary'),
    staleTime: 30000,
    ...options,
  });
}

export function usePipelineStats(
  options?: Omit<UseQueryOptions<PipelineStats>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.pipeline.stats,
    queryFn: () => apiFetch<PipelineStats>('/api/pipeline/stats'),
    staleTime: 10000,
    ...options,
  });
}

// =============================================================================
// WEBSOCKET HOOK
// =============================================================================

export function useWebSocketUpdates(
  onMessage: (data: unknown) => void,
  enabled: boolean = true
) {
  const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/ws/updates';

  // Note: This is a simple implementation. For production, consider using
  // a library like `reconnecting-websocket` or implementing reconnection logic.
  if (typeof window !== 'undefined' && enabled) {
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        console.error('Failed to parse WebSocket message');
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Return cleanup function
    return () => ws.close();
  }

  return () => {};
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { Deal, DealCreate, DealUpdate, DealEvent, DealAlias } from '@/types/api';
export type { Action, ActionApprove, ActionReject } from '@/types/api';
export type { QuarantineItem, QuarantineProcess } from '@/types/api';
export type { SenderProfile } from '@/types/api';
export type { PipelineStageSummary, PipelineStats } from '@/types/api';
