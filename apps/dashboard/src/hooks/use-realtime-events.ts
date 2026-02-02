/**
 * useRealtimeEvents Hook
 *
 * SSE-based real-time event subscription with:
 * - Automatic reconnection with exponential backoff
 * - Event ID tracking for resume capability
 * - React Query cache invalidation on events
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api-client';
import { agentQueryKeys } from '@/lib/agent-client';

// =============================================================================
// Types
// =============================================================================

export interface RealtimeEvent {
  eventId: string;
  eventType: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface RealtimeEventHandlers {
  onEvent?: (event: RealtimeEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onReconnect?: (attempt: number) => void;
}

export interface RealtimeConnectionState {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  lastEventId: string | null;
  reconnectAttempt: number;
}

export interface UseRealtimeEventsOptions extends RealtimeEventHandlers {
  enabled?: boolean;
  threadId: string;
  runId: string;
  maxReconnectAttempts?: number;
  baseReconnectDelay?: number;
  maxReconnectDelay?: number;
  invalidateOnEvents?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const DEFAULT_BASE_RECONNECT_DELAY = 1000; // 1 second
const DEFAULT_MAX_RECONNECT_DELAY = 30000; // 30 seconds

// Event types that should trigger cache invalidation
const INVALIDATION_EVENTS = new Set([
  'run_completed',
  'run_failed',
  'tool_call_completed',
  'tool_call_failed',
  'tool_approval_granted',
  'tool_approval_denied',
]);

// =============================================================================
// Hook Implementation
// =============================================================================

export function useRealtimeEvents(options: UseRealtimeEventsOptions) {
  const {
    enabled = true,
    threadId,
    runId,
    onEvent,
    onConnect,
    onDisconnect,
    onError,
    onReconnect,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
    baseReconnectDelay = DEFAULT_BASE_RECONNECT_DELAY,
    maxReconnectDelay = DEFAULT_MAX_RECONNECT_DELAY,
    invalidateOnEvents = true,
  } = options;

  const queryClient = useQueryClient();

  const [state, setState] = useState<RealtimeConnectionState>({
    connected: false,
    connecting: false,
    error: null,
    lastEventId: null,
    reconnectAttempt: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Clear reconnect timeout
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Calculate reconnect delay with exponential backoff
  const getReconnectDelay = useCallback(
    (attempt: number) => {
      const delay = Math.min(
        baseReconnectDelay * Math.pow(2, attempt),
        maxReconnectDelay
      );
      // Add jitter (0-25% of delay)
      return delay + Math.random() * delay * 0.25;
    },
    [baseReconnectDelay, maxReconnectDelay]
  );

  // Invalidate relevant queries based on event type
  const invalidateQueries = useCallback(
    (event: RealtimeEvent) => {
      if (!invalidateOnEvents) return;

      const { eventType, data } = event;

      // Run events
      if (eventType.startsWith('run_')) {
        queryClient.invalidateQueries({
          queryKey: agentQueryKeys.runs.detail(threadId, runId),
        });
        queryClient.invalidateQueries({
          queryKey: agentQueryKeys.threads.runs(threadId),
        });
      }

      // Tool call events
      if (eventType.startsWith('tool_')) {
        queryClient.invalidateQueries({
          queryKey: agentQueryKeys.runs.toolCalls(threadId, runId),
        });
        queryClient.invalidateQueries({
          queryKey: agentQueryKeys.pendingApprovals,
        });

        // If tool call has a deal association, invalidate deal queries
        const dealId = data.deal_id as string | undefined;
        if (dealId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.deals.detail(dealId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.deals.events(dealId),
          });
        }

        // If tool call created an action, invalidate actions
        const actionId = data.created_action_id as string | undefined;
        if (actionId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.actions.all,
          });
        }
      }

      // On completion events, also invalidate pipeline stats
      if (INVALIDATION_EVENTS.has(eventType)) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.pipeline.stats,
        });
      }
    },
    [invalidateOnEvents, queryClient, threadId, runId]
  );

  // Connect to SSE stream
  const connect = useCallback(
    async (lastEventId?: string) => {
      if (!enabled || !threadId || !runId) return;

      // Abort any existing connection
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState((prev) => ({
        ...prev,
        connecting: true,
        error: null,
      }));

      try {
        // Use the proxy route
        const url = new URL('/api/events', window.location.origin);
        url.searchParams.set('thread_id', threadId);
        url.searchParams.set('run_id', runId);
        if (lastEventId) {
          url.searchParams.set('last_event_id', lastEventId);
        }

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: {
            Accept: 'text/event-stream',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        // Connection established
        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            connected: true,
            connecting: false,
            reconnectAttempt: 0,
          }));
          onConnect?.();
        }

        const decoder = new TextDecoder();
        let buffer = '';

        // Process stream
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
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
                const event: RealtimeEvent = {
                  eventId: currentEvent.eventId || '',
                  eventType: currentEvent.eventType,
                  data: JSON.parse(currentEvent.data),
                  timestamp: new Date(),
                };

                // Update last event ID
                if (event.eventId && mountedRef.current) {
                  setState((prev) => ({
                    ...prev,
                    lastEventId: event.eventId,
                  }));
                }

                // Invalidate queries
                invalidateQueries(event);

                // Call event handler
                onEvent?.(event);

                // If run completed or failed, close connection
                if (
                  event.eventType === 'run_completed' ||
                  event.eventType === 'run_failed' ||
                  event.eventType === 'run_cancelled'
                ) {
                  reader.cancel();
                  break;
                }
              } catch (e) {
                console.error('Failed to parse SSE event:', e);
              }
              currentEvent = {};
            }
          }
        }

        // Stream ended normally
        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            connected: false,
            connecting: false,
          }));
          onDisconnect?.();
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Intentional abort, don't reconnect
          return;
        }

        console.error('SSE connection error:', error);

        if (mountedRef.current) {
          const err = error instanceof Error ? error : new Error(String(error));

          setState((prev) => ({
            ...prev,
            connected: false,
            connecting: false,
            error: err,
          }));
          onError?.(err);

          // Schedule reconnect
          if (state.reconnectAttempt < maxReconnectAttempts) {
            const delay = getReconnectDelay(state.reconnectAttempt);
            const nextAttempt = state.reconnectAttempt + 1;

            setState((prev) => ({
              ...prev,
              reconnectAttempt: nextAttempt,
            }));

            onReconnect?.(nextAttempt);

            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                connect(state.lastEventId || undefined);
              }
            }, delay);
          }
        }
      }
    },
    [
      enabled,
      threadId,
      runId,
      state.reconnectAttempt,
      state.lastEventId,
      maxReconnectAttempts,
      getReconnectDelay,
      invalidateQueries,
      onConnect,
      onDisconnect,
      onError,
      onEvent,
      onReconnect,
    ]
  );

  // Disconnect from SSE stream
  const disconnect = useCallback(() => {
    clearReconnectTimeout();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState({
      connected: false,
      connecting: false,
      error: null,
      lastEventId: null,
      reconnectAttempt: 0,
    });
  }, [clearReconnectTimeout]);

  // Reset reconnect attempts
  const resetReconnect = useCallback(() => {
    setState((prev) => ({
      ...prev,
      reconnectAttempt: 0,
    }));
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true;

    if (enabled && threadId && runId) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [enabled, threadId, runId]); // Note: intentionally excluding connect/disconnect to avoid infinite loops

  return {
    ...state,
    connect,
    disconnect,
    resetReconnect,
  };
}

// =============================================================================
// Simpler Hook for Global Events
// =============================================================================

export interface UseGlobalEventsOptions extends RealtimeEventHandlers {
  enabled?: boolean;
}

/**
 * Hook for subscribing to global WebSocket events (deal updates, action updates, etc.)
 */
export function useGlobalEvents(options: UseGlobalEventsOptions = {}) {
  const { enabled = true, onEvent, onConnect, onDisconnect, onError } = options;

  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const reconnectAttemptRef = useRef(0);

  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (!enabled || wsRef.current) return;

    if (!process.env.NEXT_PUBLIC_API_URL) throw new Error('NEXT_PUBLIC_API_URL is required');
    const wsUrl = process.env.NEXT_PUBLIC_API_URL
      .replace(/^http/, 'ws') + '/ws/updates';

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mountedRef.current) {
          setConnected(true);
          reconnectAttemptRef.current = 0;
          onConnect?.();
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (mountedRef.current) {
          setConnected(false);
          onDisconnect?.();

          // Reconnect with exponential backoff
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttemptRef.current),
            30000
          );
          reconnectAttemptRef.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, delay);
        }
      };

      ws.onerror = (event) => {
        onError?.(new Error('WebSocket error'));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const eventType = data.type || data.event_type || 'message';

          const realtimeEvent: RealtimeEvent = {
            eventId: data.id || '',
            eventType,
            data,
            timestamp: new Date(),
          };

          // Invalidate relevant queries
          if (data.deal_id) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.deals.detail(data.deal_id),
            });
          }
          if (data.action_id) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.actions.all,
            });
          }
          if (eventType.includes('quarantine')) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.quarantine.all,
            });
          }

          onEvent?.(realtimeEvent);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [enabled, onConnect, onDisconnect, onError, onEvent, queryClient]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [enabled]); // Note: intentionally excluding connect/disconnect

  return { connected, connect, disconnect };
}
