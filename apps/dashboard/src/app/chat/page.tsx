'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  IconAlertTriangle,
  IconBrain,
  IconChevronDown,
  IconDatabase,
  IconLink,
  IconLoader2,
  IconMessage,
  IconRefresh,
  IconSend,
  IconWorld,
  IconFolder,
  IconFile,
  IconCheck,
  IconX,
  IconBug,
} from '@tabler/icons-react';
import {
  getDeals,
  streamChatMessage,
  executeChatProposal,
  getChatSession,
  type Deal,
  type ChatScope,
  type ChatCitation,
  type ChatProposal,
  type ChatEvidenceSummary,
  normalizeChatProposalType,
} from '@/lib/api';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: ChatCitation[];
  proposals?: ChatProposal[];
  evidenceSummary?: ChatEvidenceSummary;
  isStreaming?: boolean;
  error?: string;
  warnings?: string[];
  timings?: TimingData;
}

interface TimingData {
  request_id: string;
  total_ms: number;
  evidence_ms: number;
  llm_ms: number;
  deterministic_ms: number;
  cache_hit: boolean;
  cache_source?: string;
  provider_used: string;
  provider_fallback: boolean;
  provider_reason?: string;
  degraded: boolean;
  evidence_breakdown: Record<string, number>;
}

interface ProgressStep {
  step: string;
  substep?: string;
  message: string;
  phase?: number;
  total_phases?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// localStorage Persistence
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'zakops-chat-session';
const STORAGE_VERSION = 1;

interface StoredSession {
  version: number;
  sessionId: string | null;
  scopeType: 'global' | 'deal' | 'document';
  selectedDealId: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    citations?: ChatCitation[];
    proposals?: ChatProposal[];
    evidenceSummary?: ChatEvidenceSummary;
    timings?: TimingData;
    warnings?: string[];
  }>;
  lastTimings: TimingData | null;
  savedAt: string;
}

// Async save using requestIdleCallback to avoid blocking UI
function saveSession(
  sessionId: string | null,
  scopeType: 'global' | 'deal' | 'document',
  selectedDealId: string,
  messages: ChatMessage[],
  lastTimings: TimingData | null
) {
  const doSave = () => {
    try {
      const data: StoredSession = {
        version: STORAGE_VERSION,
        sessionId,
        scopeType,
        selectedDealId,
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
          citations: m.citations,
          proposals: m.proposals,
          evidenceSummary: m.evidenceSummary,
          timings: m.timings,
          warnings: m.warnings,
        })),
        lastTimings,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save chat session:', e);
    }
  };

  // Use requestIdleCallback if available for non-blocking save
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(doSave, { timeout: 1000 });
  } else {
    // Fallback: use setTimeout to avoid blocking
    setTimeout(doSave, 0);
  }
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredSession;
    if (data.version !== STORAGE_VERSION) return null;
    return data;
  } catch (e) {
    console.warn('Failed to load chat session:', e);
    return null;
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear chat session:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export default function ChatPage() {
  const searchParams = useSearchParams();
  const initialDealId = searchParams.get('deal_id');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Scope state
  const [scopeType, setScopeType] = useState<'global' | 'deal' | 'document'>(
    initialDealId ? 'deal' : 'global'
  );
  const [selectedDealId, setSelectedDealId] = useState<string>(initialDealId || '');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);

  // Evidence panel
  const [showEvidence, setShowEvidence] = useState(false);
  const [currentEvidence, setCurrentEvidence] = useState<ChatEvidenceSummary | null>(null);

  // Progress and debug state
  const [progressStep, setProgressStep] = useState<ProgressStep | null>(null);
  const [progressHistory, setProgressHistory] = useState<ProgressStep[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [lastTimings, setLastTimings] = useState<TimingData | null>(null);

  // Refs for token batching
  const tokenBufferRef = useRef<string>('');
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Session Restoration (backend-first, then localStorage fallback)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Skip if we have a deal_id in URL (fresh start with deal)
    if (initialDealId) {
      setIsInitialized(true);
      return;
    }

    const restoreSession = async () => {
      // First, try localStorage to get sessionId
      const stored = loadSession();
      const storedSessionId = stored?.sessionId;

      // If we have a sessionId, try loading from backend (SQLite-backed)
      if (storedSessionId) {
        try {
          const backendSession = await getChatSession(storedSessionId);
          if (backendSession && backendSession.messages.length > 0) {
            // Restore from backend (more reliable, survives server restarts)
            setSessionId(backendSession.session_id);
            setScopeType(backendSession.scope?.type || 'global');
            setSelectedDealId(backendSession.scope?.deal_id || '');
            setMessages(backendSession.messages.map((m, i) => ({
              id: `restored-${i}-${Date.now()}`,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              timestamp: new Date(m.timestamp),
              citations: m.citations || [],
              proposals: (m.proposals || [])
                .map((p) => {
                  const normalizedType = normalizeChatProposalType(p.type);
                  return normalizedType ? { ...p, type: normalizedType } : null;
                })
                .filter((p): p is ChatProposal => p !== null),
              timings: m.timings as TimingData | undefined,
              warnings: m.warnings || [],
            })));

            console.log('Session restored from backend:', storedSessionId);
            setIsInitialized(true);
            return;
          }
        } catch (err) {
          console.log('Backend session not found, falling back to localStorage:', err);
        }
      }

      // Fallback: restore from localStorage
      if (stored && stored.messages.length > 0) {
        setSessionId(stored.sessionId);
        setScopeType(stored.scopeType);
        setSelectedDealId(stored.selectedDealId);
        setMessages(stored.messages.map(m => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })));
        setLastTimings(stored.lastTimings);

        // Find latest evidence summary
        const lastAssistant = [...stored.messages].reverse().find(m => m.role === 'assistant');
        if (lastAssistant?.evidenceSummary) {
          setCurrentEvidence(lastAssistant.evidenceSummary);
        }
        console.log('Session restored from localStorage');
      }

      setIsInitialized(true);
    };

    restoreSession();
  }, [initialDealId]);

  // Save session whenever messages change
  useEffect(() => {
    if (isInitialized && messages.length > 0) {
      saveSession(sessionId, scopeType, selectedDealId, messages, lastTimings);
    }
  }, [messages, sessionId, scopeType, selectedDealId, lastTimings, isInitialized]);

  // ─────────────────────────────────────────────────────────────────────────
  // Load deals for scope selector
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadDeals = async () => {
      try {
        const dealList = await getDeals({ status: 'active' });
        setDeals(dealList);
      } catch (err) {
        console.error('Failed to load deals:', err);
      } finally {
        setLoadingDeals(false);
      }
    };
    loadDeals();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-scroll to bottom (only if user is near bottom)
  // ─────────────────────────────────────────────────────────────────────────
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);

  const updateIsNearBottom = useCallback(() => {
    const container = scrollViewportRef.current;
    if (!container) return;
    const threshold = 100; // pixels from bottom
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    isNearBottomRef.current = isNearBottom;
  }, []);

  const handleScroll = useCallback(() => {
    updateIsNearBottom();
  }, [updateIsNearBottom]);

  // Auto-scroll only when near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [messages]);

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup on unmount
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Build current scope
  // ─────────────────────────────────────────────────────────────────────────
  const getScope = useCallback((): ChatScope => {
    if (scopeType === 'deal' && selectedDealId) {
      return { type: 'deal', deal_id: selectedDealId };
    }
    return { type: scopeType };
  }, [scopeType, selectedDealId]);

  // ─────────────────────────────────────────────────────────────────────────
  // Token Batching - Flush buffered tokens to UI
  // ─────────────────────────────────────────────────────────────────────────
  const flushTokenBuffer = useCallback(() => {
    if (tokenBufferRef.current && currentMessageIdRef.current) {
      const bufferedContent = tokenBufferRef.current;
      const messageId = currentMessageIdRef.current;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: m.content + bufferedContent }
            : m
        )
      );
      tokenBufferRef.current = '';
    }
    flushTimeoutRef.current = null;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Send message with batched streaming
  // ─────────────────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const assistantMessageId = `assistant-${Date.now()}`;
    currentMessageIdRef.current = assistantMessageId;

    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);
    setProgressStep(null);
    setProgressHistory([]);
    tokenBufferRef.current = '';

    try {
      const scope = getScope();
      let citations: ChatCitation[] = [];
      let proposals: ChatProposal[] = [];
      let evidenceSummary: ChatEvidenceSummary | undefined = undefined;
      let newSessionId: string | undefined;
      let timings: TimingData | undefined;
      let warnings: string[] = [];
      let finalTextFromDone: string | undefined;  // Capture final_text from done event

      for await (const event of streamChatMessage(
        userMessage.content,
        scope,
        sessionId || undefined
      )) {
        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) break;

        if (event.type === 'token') {
          const tokenData = event.data as { token?: string };
          if (tokenData.token) {
            // Buffer tokens instead of immediate setState
            tokenBufferRef.current += tokenData.token;

            // Schedule flush if not already scheduled (100ms batching for 30-60fps)
            if (!flushTimeoutRef.current) {
              flushTimeoutRef.current = setTimeout(flushTokenBuffer, 100);
            }
          }
        } else if (event.type === 'progress') {
          const progressData = event.data as ProgressStep;
          setProgressStep(progressData);
          setProgressHistory(prev => [...prev, progressData]);
        } else if (event.type === 'evidence') {
          evidenceSummary = event.data as ChatEvidenceSummary;
          setCurrentEvidence(evidenceSummary);
        } else if (event.type === 'done') {
          // Flush any remaining tokens
          if (flushTimeoutRef.current) {
            clearTimeout(flushTimeoutRef.current);
            flushTimeoutRef.current = null;
          }
          flushTokenBuffer();

          const doneData = event.data as {
            citations?: ChatCitation[];
            proposals?: ChatProposal[];
            session_id?: string;
            warnings?: string[];
            timings?: TimingData;
            evidence_summary?: ChatEvidenceSummary;
            final_text?: string;  // Backend includes final text for deterministic reliability
          };
          citations = doneData.citations || [];
          proposals = (doneData.proposals || [])
            .map((p) => {
              const normalizedType = normalizeChatProposalType(p.type);
              return normalizedType ? { ...p, type: normalizedType } : null;
            })
            .filter((p): p is ChatProposal => p !== null);
          newSessionId = doneData.session_id;
          timings = doneData.timings;
          warnings = doneData.warnings || [];

          // Capture final_text from done event (more reliable than token buffering)
          finalTextFromDone = doneData.final_text;

          if (doneData.evidence_summary) {
            evidenceSummary = doneData.evidence_summary;
            setCurrentEvidence(evidenceSummary);
          }

          if (timings) {
            setLastTimings(timings);
          }

          // Show warnings if any
          if (warnings.length > 0) {
            setError(`Warnings: ${warnings.join(', ')}`);
          }

          setProgressStep(null);
        } else if (event.type === 'error') {
          const errorData = event.data as { message?: string };
          throw new Error(errorData.message || 'Stream error');
        }
      }

      // Ensure final flush
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTokenBuffer();
      }

      // Get final content - prefer final_text from done event (most reliable),
      // fall back to token buffer accumulation, then to message state
      const finalContent = (() => {
        // Primary: Use final_text from done event (backend provides this for reliability)
        if (finalTextFromDone) {
          return finalTextFromDone;
        }
        // Fallback: Use accumulated tokens from buffer + any flushed to state
        const msg = messages.find(m => m.id === assistantMessageId);
        return (msg?.content || '') + tokenBufferRef.current;
      })();

      // Update final message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: finalContent || 'No response received.',
                isStreaming: false,
                citations,
                proposals,
                evidenceSummary,
                timings,
                warnings,
              }
            : m
        )
      );

      if (newSessionId) {
        setSessionId(newSessionId);
      }
    } catch (err) {
      // Flush any remaining tokens before error
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTokenBuffer();
      }

      let errorMsg = 'Failed to get response';
      let detailedError = '';

      if (err && typeof err === 'object' && 'status' in err && 'endpoint' in err) {
        const apiErr = err as { status: number; endpoint: string; message: string };
        errorMsg = `HTTP ${apiErr.status} at ${apiErr.endpoint}`;
        detailedError = apiErr.message;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }

      const fullError = detailedError ? `${errorMsg}\n${detailedError}` : errorMsg;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: 'Error: ' + errorMsg,
                isStreaming: false,
                error: fullError,
              }
            : m
        )
      );
      setError(fullError);
    } finally {
      setIsLoading(false);
      currentMessageIdRef.current = null;
      tokenBufferRef.current = '';
      inputRef.current?.focus();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Execute proposal
  // ─────────────────────────────────────────────────────────────────────────
  const [executingProposalId, setExecutingProposalId] = useState<string | null>(null);
  const [lastProposalExecution, setLastProposalExecution] = useState<{
    proposalId: string;
    type: ChatProposal['type'];
    action: 'approve' | 'reject';
    success: boolean;
    provider?: string;
    model?: string;
    forcedReason?: string;
    error?: string;
    reason?: string;
    at: string;
  } | null>(null);

  const handleExecuteProposal = async (
    proposal: ChatProposal,
    messageId: string,
    action: 'approve' | 'reject' = 'approve'
  ) => {
    if (!sessionId) {
      setError('No session ID - please refresh and try again');
      return;
    }

    // Set loading state
    setExecutingProposalId(proposal.proposal_id);

    try {
      const result = await executeChatProposal(
        proposal.proposal_id,
        sessionId,
        'operator',
        action
      );

      if (result.success) {
        const r = (result.result as any) || {};
        const provider = typeof r.provider === 'string' ? r.provider : undefined;
        const model = typeof r.model === 'string' ? r.model : undefined;
        const forcedReason = typeof r.forced_reason === 'string' ? r.forced_reason : undefined;
        setLastProposalExecution({
          proposalId: proposal.proposal_id,
          type: proposal.type,
          action,
          success: true,
          provider,
          model,
          forcedReason,
          at: new Date().toISOString(),
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  proposals: m.proposals?.map((p) =>
                    p.proposal_id === proposal.proposal_id
                      ? (result.proposal ?? {
                          ...p,
                          status: action === 'reject' ? 'rejected' : 'executed',
                          result: result.result,
                        })
                      : p
                  ),
                }
              : m
          )
        );
      } else {
        // Show detailed error and update proposal status to failed
        const errorMsg = result.reason
          ? `${result.error} (${result.reason})`
          : result.error || 'Failed to execute proposal';
        setError(errorMsg);
        setLastProposalExecution({
          proposalId: proposal.proposal_id,
          type: proposal.type,
          action,
          success: false,
          error: result.error || errorMsg,
          reason: result.reason,
          at: new Date().toISOString(),
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  proposals: m.proposals?.map((p) =>
                    p.proposal_id === proposal.proposal_id
                      ? { ...p, status: 'failed' as const, error: result.error || errorMsg }
                      : p
                  ),
                }
              : m
          )
        );
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Execution failed';
      setError(errorMsg);
      setLastProposalExecution({
        proposalId: proposal.proposal_id,
        type: proposal.type,
        action,
        success: false,
        error: errorMsg,
        at: new Date().toISOString(),
      });
      // Update proposal status to failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                proposals: m.proposals?.map((p) =>
                  p.proposal_id === proposal.proposal_id
                    ? { ...p, status: 'failed' as const, error: errorMsg }
                    : p
                ),
              }
            : m
        )
      );
    } finally {
      setExecutingProposalId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Handle enter key
  // ─────────────────────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // New chat
  // ─────────────────────────────────────────────────────────────────────────
  const handleNewChat = () => {
    // Abort any in-progress request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setMessages([]);
    setSessionId(null);
    setCurrentEvidence(null);
    setError(null);
    setProgressStep(null);
    setProgressHistory([]);
    setLastTimings(null);
    clearStoredSession();
  };

  return (
    <div className='flex flex-1 flex-col min-h-0'>
      {/* Header */}
      <div className='flex items-center justify-between p-4 border-b'>
        <div className='flex items-center gap-2'>
          <IconMessage className='h-6 w-6' />
          <h1 className='text-xl font-semibold'>Chat</h1>
          {sessionId && (
            <Badge variant='outline' className='ml-2'>
              Session: {sessionId}
            </Badge>
          )}
          {messages.length > 0 && (
            <Badge variant='secondary' className='ml-1'>
              {messages.length} messages
            </Badge>
          )}
        </div>

        <div className='flex items-center gap-2'>
          {/* Scope selector */}
          <div className='flex items-center gap-2'>
            <Select
              value={scopeType}
              onValueChange={(v) => setScopeType(v as 'global' | 'deal' | 'document')}
            >
              <SelectTrigger className='w-[130px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='global'>
                  <div className='flex items-center gap-2'>
                    <IconWorld className='h-4 w-4' />
                    Global
                  </div>
                </SelectItem>
                <SelectItem value='deal'>
                  <div className='flex items-center gap-2'>
                    <IconFolder className='h-4 w-4' />
                    Deal
                  </div>
                </SelectItem>
                <SelectItem value='document'>
                  <div className='flex items-center gap-2'>
                    <IconFile className='h-4 w-4' />
                    Document
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {scopeType === 'deal' && (
              <Select
                value={selectedDealId || '_none'}
                onValueChange={(v) => setSelectedDealId(v === '_none' ? '' : v)}
                disabled={loadingDeals}
              >
                <SelectTrigger className='w-[200px]'>
                  <SelectValue placeholder='Select deal...' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='_none'>Select deal...</SelectItem>
                  {deals.map((deal) => (
                    <SelectItem key={deal.deal_id} value={deal.deal_id}>
                      {deal.canonical_name || deal.deal_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button variant='outline' size='sm' onClick={handleNewChat}>
            <IconRefresh className='h-4 w-4 mr-1' />
            New Chat
          </Button>

          <Button
            variant='outline'
            size='sm'
            onClick={() => setShowEvidence(!showEvidence)}
          >
            <IconDatabase className='h-4 w-4 mr-1' />
            Evidence
          </Button>

          <Button
            variant={showDebug ? 'default' : 'outline'}
            size='sm'
            data-testid='chat-debug-toggle'
            onClick={() => setShowDebug(!showDebug)}
          >
            <IconBug className='h-4 w-4 mr-1' />
            Debug
          </Button>
        </div>
      </div>

      {/* Progress indicator - always visible during loading */}
      {(progressStep || isLoading) && (
        <div className='px-4 py-2 bg-muted/50 border-b'>
          <ProgressIndicator
            step={progressStep}
            history={progressHistory}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Main content */}
      <div className='flex flex-1 overflow-hidden min-h-0'>
        {/* Messages area */}
        <div className='flex flex-1 flex-col min-h-0'>
          <div
            ref={scrollViewportRef}
            onScroll={handleScroll}
            data-testid='chat-scroll'
            className='flex-1 min-h-0 overflow-y-auto p-4'
          >
            {messages.length === 0 ? (
              <div className='flex flex-col items-center justify-center h-full text-muted-foreground'>
                <IconBrain className='h-16 w-16 mb-4 opacity-30' />
                <h2 className='text-lg font-medium mb-2'>ZakOps Assistant</h2>
                <p className='text-sm text-center max-w-md'>
                  Ask questions about your deals, get AI-powered insights,
                  and receive actionable suggestions grounded in your data.
                </p>
                <div className='flex flex-wrap gap-2 mt-4'>
                  <Badge variant='secondary'>RAG-powered</Badge>
                  <Badge variant='secondary'>Grounded responses</Badge>
                  <Badge variant='secondary'>Action proposals</Badge>
                </div>
                <p className='text-xs text-muted-foreground mt-4'>
                  Your chat history is saved to both server and browser, persisting across refreshes and restarts.
                </p>
              </div>
            ) : (
              <div className='space-y-4 max-w-3xl mx-auto'>
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onExecuteProposal={(p, action) => handleExecuteProposal(p, message.id, action)}
                    executingProposalId={executingProposalId}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className='px-4 pb-2'>
              <div className='bg-destructive/10 text-destructive rounded-md p-3'>
                <div className='flex items-start gap-2'>
                  <IconAlertTriangle className='h-4 w-4 mt-0.5 flex-shrink-0' />
                  <div className='flex-1 min-w-0'>
                    <pre className='text-sm whitespace-pre-wrap break-words font-sans'>
                      {error}
                    </pre>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setError(null)}
                    className='flex-shrink-0'
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Input area */}
          <div className='p-4 border-t'>
            <div className='flex gap-2 max-w-3xl mx-auto'>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                data-testid='chat-input'
                placeholder={
                  scopeType === 'deal' && selectedDealId
                    ? `Ask about ${deals.find((d) => d.deal_id === selectedDealId)?.canonical_name || selectedDealId}...`
                    : 'Ask a question...'
                }
                disabled={isLoading}
                className='flex-1'
              />
              <Button data-testid='chat-send' onClick={sendMessage} disabled={isLoading || !input.trim()}>
                {isLoading ? (
                  <IconLoader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <IconSend className='h-4 w-4' />
                )}
              </Button>
            </div>
            <p className='text-xs text-muted-foreground text-center mt-2'>
              Responses are grounded in deal data. Proposals require approval.
            </p>
          </div>
        </div>

        {/* Evidence panel */}
        {showEvidence && (
          <div className='w-80 border-l overflow-auto p-4'>
            <h3 className='font-semibold mb-3 flex items-center gap-2'>
              <IconDatabase className='h-4 w-4' />
              Evidence Summary
            </h3>
            {currentEvidence ? (
              <EvidencePanel evidence={currentEvidence} />
            ) : (
              <p className='text-sm text-muted-foreground'>
                Evidence will appear here after you send a message.
              </p>
            )}
          </div>
        )}

        {/* Debug panel - always visible when toggled */}
        {showDebug && (
          <div data-testid='chat-debug-panel' className='w-80 border-l overflow-auto p-4 bg-muted/30'>
            <h3 className='font-semibold mb-3 flex items-center gap-2'>
              <IconBug className='h-4 w-4' />
              Debug Info
            </h3>
            <DebugPanel
              timing={lastTimings}
              progressHistory={progressHistory}
              sessionId={sessionId}
              messageCount={messages.length}
              lastProposalExecution={lastProposalExecution}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Message bubble component
// ═══════════════════════════════════════════════════════════════════════════

function MessageBubble({
  message,
  onExecuteProposal,
  executingProposalId,
}: {
  message: ChatMessage;
  onExecuteProposal: (p: ChatProposal, action?: 'approve' | 'reject') => void;
  executingProposalId?: string | null;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg p-3 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : message.error
              ? 'bg-destructive/10 border border-destructive/20'
              : 'bg-muted'
        }`}
      >
        <div className='whitespace-pre-wrap text-sm'>{message.content}</div>

        {message.isStreaming && (
          <div className='flex items-center gap-2 mt-2 text-xs text-muted-foreground'>
            <IconLoader2 className='h-3 w-3 animate-spin' />
            <span>Generating...</span>
          </div>
        )}

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <Collapsible className='mt-3'>
            <CollapsibleTrigger className='flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground'>
              <IconLink className='h-3 w-3' />
              {message.citations.length} citation(s)
              <IconChevronDown className='h-3 w-3' />
            </CollapsibleTrigger>
            <CollapsibleContent className='mt-2 space-y-2'>
              {message.citations.map((cite) => (
                <div
                  key={cite.id}
                  className='text-xs bg-background/50 rounded p-2 border'
                >
                  <div className='flex items-center gap-1 font-medium'>
                    <Badge variant='outline' className='text-[10px]'>
                      {cite.source}
                    </Badge>
                    <span>{cite.id}</span>
                  </div>
                  <p className='mt-1 text-muted-foreground line-clamp-2'>
                    {cite.snippet}
                  </p>
                  {cite.url && (
                    <a
                      href={cite.url}
                      className='text-primary hover:underline mt-1 block truncate'
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {cite.url}
                    </a>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Proposals */}
        {message.proposals && message.proposals.length > 0 && (
          <div className='mt-3 space-y-2'>
            <p className='text-xs font-medium text-muted-foreground'>
              Proposed Actions:
            </p>
            {message.proposals.map((proposal) => (
              <div
                key={proposal.proposal_id}
                data-testid={`proposal-${proposal.proposal_id}`}
                className='bg-background rounded p-2 border text-xs'
              >
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <Badge variant='secondary'>{proposal.type}</Badge>
                    {proposal.deal_id && (
                      <span className='text-muted-foreground'>
                        {proposal.deal_id}
                      </span>
                    )}
                  </div>
                  <Badge
                    variant={
                      proposal.status === 'executed'
                        ? 'default'
                        : proposal.status === 'failed'
                          ? 'destructive'
                          : 'outline'
                    }
                  >
                    {proposal.status}
                  </Badge>
                </div>
                {proposal.reason && (
                  <p className='mt-1 text-muted-foreground'>{proposal.reason}</p>
                )}

                {proposal.status === 'executed' && proposal.result != null && (
                  <div className='mt-2 text-xs'>
                    {proposal.type === 'draft_email' ? (
                      <div className='rounded border bg-muted/30 p-2'>
                        {(() => {
                          const r: any = proposal.result;
                          const draft: any = r?.email_draft ?? r;
                          const subject = r?.subject ?? draft?.subject;
                          const body = draft?.body;
                          const provider = r?.provider ?? draft?.provider;
                          const model = r?.model ?? draft?.model;

                          return (
                            <>
                              {subject && (
                                <div className='font-medium mb-1'>
                                  Subject: <span className='font-normal'>{subject}</span>
                                </div>
                              )}
                              {body && (
                                <pre className='whitespace-pre-wrap break-words font-sans text-[11px]'>
                                  {body}
                                </pre>
                              )}
                              {(provider || model) && (
                                <div className='mt-2 text-[10px] text-muted-foreground'>
                                  {provider ? `provider=${provider}` : null}
                                  {provider && model ? ' • ' : null}
                                  {model ? `model=${model}` : null}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    ) : proposal.type === 'create_task' ? (
                      <div className='text-muted-foreground'>
                        Task created: {(proposal.result as any).action_id || 'ok'}
                      </div>
                    ) : proposal.type === 'add_note' ? (
                      <div className='text-muted-foreground'>
                        Note saved: {(proposal.result as any).event_id || 'ok'}
                      </div>
                    ) : proposal.type === 'stage_transition' ? (
                      <div className='text-muted-foreground'>
                        Stage transition: {(proposal.result as any).from_stage} → {(proposal.result as any).to_stage}
                      </div>
                    ) : null}
                  </div>
                )}

                {(proposal.status === 'pending_approval' || proposal.status === 'failed') && (
                  <div className='flex gap-2 mt-2'>
                    <Button
                      size='sm'
                      variant='default'
                      className='h-6 text-xs'
                      data-testid={`proposal-approve-${proposal.proposal_id}`}
                      disabled={executingProposalId === proposal.proposal_id}
                      onClick={() => onExecuteProposal(proposal, 'approve')}
                    >
                      {executingProposalId === proposal.proposal_id ? (
                        <IconLoader2 className='h-3 w-3 mr-1 animate-spin' />
                      ) : (
                        <IconCheck className='h-3 w-3 mr-1' />
                      )}
                      {executingProposalId === proposal.proposal_id
                        ? 'Executing...'
                        : proposal.status === 'failed'
                          ? 'Retry'
                          : 'Approve'}
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      className='h-6 text-xs'
                      data-testid={`proposal-reject-${proposal.proposal_id}`}
                      disabled={executingProposalId === proposal.proposal_id}
                      onClick={() => onExecuteProposal(proposal, 'reject')}
                    >
                      <IconX className='h-3 w-3 mr-1' />
                      Reject
                    </Button>
                  </div>
                )}
                {proposal.status === 'rejected' && (
                  <p className='mt-1 text-xs text-muted-foreground italic'>Rejected by user</p>
                )}
                {proposal.status === 'failed' && (
                  <p className='mt-1 text-xs text-destructive'>
                    Failed: {(proposal as any).error || 'Unknown error'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Timing info (compact) */}
        {message.timings && !message.isStreaming && (
          <div className='text-[10px] text-muted-foreground mt-2 flex items-center gap-2'>
            <span>{message.timings.provider_used}</span>
            <span>•</span>
            <span>{message.timings.total_ms}ms</span>
            {message.timings.cache_hit && (
              <>
                <span>•</span>
                <Badge variant='outline' className='text-[8px] py-0'>cached</Badge>
              </>
            )}
          </div>
        )}

        <div className='text-[10px] text-muted-foreground mt-1'>
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Evidence panel component
// ═══════════════════════════════════════════════════════════════════════════

function EvidencePanel({ evidence }: { evidence: ChatEvidenceSummary }) {
  return (
    <div className='space-y-4 text-sm'>
      {/* Sources queried */}
      <div>
        <p className='text-xs font-medium text-muted-foreground mb-1'>
          Sources Queried
        </p>
        <div className='flex flex-wrap gap-1'>
          {evidence.sources_queried.map((source) => (
            <Badge key={source} variant='secondary' className='text-xs'>
              {source}
            </Badge>
          ))}
        </div>
      </div>

      {/* RAG */}
      <Card className='p-3'>
        <p className='font-medium text-xs'>RAG Search</p>
        <div className='mt-1 space-y-1 text-xs text-muted-foreground'>
          <p>Query: {evidence.rag.query.slice(0, 50)}...</p>
          <p>Results: {evidence.rag.results_found}</p>
          <p>Top similarity: {(evidence.rag.top_similarity * 100).toFixed(1)}%</p>
        </div>
      </Card>

      {/* Events */}
      {evidence.events.count > 0 && (
        <Card className='p-3'>
          <p className='font-medium text-xs'>Events</p>
          <div className='mt-1 space-y-1 text-xs text-muted-foreground'>
            <p>Window: {evidence.events.window}</p>
            <p>Count: {evidence.events.count}</p>
            <p>Types: {evidence.events.types.join(', ')}</p>
          </div>
        </Card>
      )}

      {/* Case File */}
      {evidence.case_file.loaded && (
        <Card className='p-3'>
          <p className='font-medium text-xs'>Case File</p>
          <div className='mt-1 text-xs text-muted-foreground'>
            <p>Sections: {evidence.case_file.sections_used.join(', ')}</p>
          </div>
        </Card>
      )}

      {/* Registry */}
      {evidence.registry.loaded && (
        <Card className='p-3'>
          <p className='font-medium text-xs'>Registry</p>
          <div className='mt-1 text-xs text-muted-foreground'>
            <p>Stage: {evidence.registry.stage || 'Unknown'}</p>
          </div>
        </Card>
      )}

      {/* Actions */}
      {evidence.actions.count > 0 && (
        <Card className='p-3'>
          <p className='font-medium text-xs'>Pending Actions</p>
          <div className='mt-1 text-xs text-muted-foreground'>
            <p>Count: {evidence.actions.count}</p>
          </div>
        </Card>
      )}

      {/* Total size */}
      <p className='text-xs text-muted-foreground'>
        Total evidence: {(evidence.total_evidence_size / 1000).toFixed(1)}KB
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Progress indicator component
// ═══════════════════════════════════════════════════════════════════════════

function ProgressIndicator({
  step,
  history,
  isLoading
}: {
  step: ProgressStep | null;
  history: ProgressStep[];
  isLoading: boolean;
}) {
  const phases = ['routing', 'evidence', 'llm', 'complete'];
  const currentPhase = step?.phase || 0;
  const currentStep = step?.step || '';

  return (
    <div className='space-y-2'>
      {/* Phase dots */}
      <div className='flex items-center gap-3'>
        <div className='flex items-center gap-1.5'>
          {phases.map((phase, i) => {
            const phaseNum = i + 1;
            const isComplete = currentPhase > phaseNum;
            const isCurrent = currentPhase === phaseNum || currentStep === phase;

            return (
              <div key={phase} className='flex items-center gap-1'>
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    isComplete
                      ? 'bg-primary'
                      : isCurrent
                        ? 'bg-primary animate-pulse ring-2 ring-primary/30'
                        : 'bg-muted-foreground/30'
                  }`}
                  title={phase}
                />
                {i < phases.length - 1 && (
                  <div className={`w-4 h-0.5 ${isComplete ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                )}
              </div>
            );
          })}
        </div>

        {step && (
          <div className='flex items-center gap-2 text-sm'>
            <IconLoader2 className='h-4 w-4 animate-spin text-primary' />
            <span className='text-muted-foreground'>{step.message}</span>
          </div>
        )}

        {!step && isLoading && (
          <div className='flex items-center gap-2 text-sm'>
            <IconLoader2 className='h-4 w-4 animate-spin text-primary' />
            <span className='text-muted-foreground'>Processing...</span>
          </div>
        )}
      </div>

      {/* Progress history (collapsed by default) */}
      {history.length > 1 && (
        <Collapsible>
          <CollapsibleTrigger className='text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1'>
            <IconChevronDown className='h-3 w-3' />
            {history.length} steps
          </CollapsibleTrigger>
          <CollapsibleContent className='mt-1'>
            <div className='text-[10px] text-muted-foreground space-y-0.5 pl-2 border-l'>
              {history.map((h, i) => (
                <div key={i} className='flex items-center gap-1'>
                  <IconCheck className='h-3 w-3 text-primary' />
                  <span>{h.substep || h.step}: {h.message}</span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Debug panel component
// ═══════════════════════════════════════════════════════════════════════════

function DebugPanel({
  timing,
  progressHistory,
  sessionId,
  messageCount,
  lastProposalExecution,
}: {
  timing: TimingData | null;
  progressHistory: ProgressStep[];
  sessionId: string | null;
  messageCount: number;
  lastProposalExecution: {
    proposalId: string;
    type: ChatProposal['type'];
    action: 'approve' | 'reject';
    success: boolean;
    provider?: string;
    model?: string;
    forcedReason?: string;
    error?: string;
    reason?: string;
    at: string;
  } | null;
}) {
  return (
    <div className='space-y-4 text-sm'>
      {/* Session info */}
      <Card className='p-3'>
        <p className='font-medium text-xs mb-2'>Session</p>
        <div className='space-y-1 text-xs'>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>ID:</span>
            <span className='font-mono'>{sessionId || 'none'}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Messages:</span>
            <span>{messageCount}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Persistence:</span>
            <div className='flex gap-1'>
              <Badge variant='outline' className='text-[10px]'>SQLite</Badge>
              <Badge variant='secondary' className='text-[10px]'>+localStorage</Badge>
            </div>
          </div>
        </div>
      </Card>

      {lastProposalExecution && (
        <Card className='p-3'>
          <p className='font-medium text-xs mb-2'>Last Proposal</p>
          <div className='space-y-1 text-xs'>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Action:</span>
              <Badge variant='outline'>{lastProposalExecution.action}</Badge>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Type:</span>
              <Badge variant='secondary'>{lastProposalExecution.type}</Badge>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Status:</span>
              <Badge variant={lastProposalExecution.success ? 'default' : 'destructive'}>
                {lastProposalExecution.success ? 'success' : 'failed'}
              </Badge>
            </div>
            {lastProposalExecution.provider && (
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Provider:</span>
                <span className='font-mono'>{lastProposalExecution.provider}</span>
              </div>
            )}
            {lastProposalExecution.model && (
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Model:</span>
                <span className='font-mono'>{lastProposalExecution.model}</span>
              </div>
            )}
            {lastProposalExecution.forcedReason && (
              <p className='text-muted-foreground mt-1 text-[10px]'>
                forced_reason={lastProposalExecution.forcedReason}
              </p>
            )}
            {!lastProposalExecution.success && lastProposalExecution.error && (
              <p className='text-destructive mt-1 text-[10px] break-words'>
                {lastProposalExecution.reason
                  ? `${lastProposalExecution.error} (${lastProposalExecution.reason})`
                  : lastProposalExecution.error}
              </p>
            )}
          </div>
        </Card>
      )}

      {timing ? (
        <>
          {/* Provider info */}
          <Card className='p-3'>
            <p className='font-medium text-xs mb-2'>Provider</p>
            <div className='space-y-1 text-xs'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Used:</span>
                <Badge variant='secondary'>{timing.provider_used}</Badge>
              </div>
              {timing.provider_fallback && (
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Fallback:</span>
                  <Badge variant='destructive'>Yes</Badge>
                </div>
              )}
              {timing.provider_reason && (
                <p className='text-muted-foreground mt-1 text-[10px]'>
                  {timing.provider_reason}
                </p>
              )}
            </div>
          </Card>

          {/* Timing breakdown */}
          <Card className='p-3'>
            <p className='font-medium text-xs mb-2'>Timing</p>
            <div className='space-y-1 text-xs'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Total:</span>
                <span className='font-mono font-semibold'>{timing.total_ms}ms</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Evidence:</span>
                <span className='font-mono'>
                  {timing.evidence_ms}ms
                  {timing.cache_hit && (
                    <Badge variant='outline' className='ml-1 text-[10px]'>
                      cached
                    </Badge>
                  )}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>LLM:</span>
                <span className='font-mono'>{timing.llm_ms}ms</span>
              </div>
              {timing.deterministic_ms > 0 && (
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Deterministic:</span>
                  <span className='font-mono'>{timing.deterministic_ms}ms</span>
                </div>
              )}
            </div>

            {/* Timing bar visualization */}
            {timing.total_ms > 0 && (
              <div className='mt-2'>
                <div className='h-2 w-full bg-muted rounded-full overflow-hidden flex'>
                  <div
                    className='bg-blue-500 h-full'
                    style={{ width: `${(timing.evidence_ms / timing.total_ms) * 100}%` }}
                    title={`Evidence: ${timing.evidence_ms}ms`}
                  />
                  <div
                    className='bg-green-500 h-full'
                    style={{ width: `${(timing.llm_ms / timing.total_ms) * 100}%` }}
                    title={`LLM: ${timing.llm_ms}ms`}
                  />
                </div>
                <div className='flex justify-between text-[10px] mt-0.5'>
                  <span className='text-blue-500'>Evidence</span>
                  <span className='text-green-500'>LLM</span>
                </div>
              </div>
            )}
          </Card>

          {/* Cache info */}
          <Card className='p-3'>
            <p className='font-medium text-xs mb-2'>Cache</p>
            <div className='space-y-1 text-xs'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Hit:</span>
                <span className={timing.cache_hit ? 'text-green-500' : ''}>
                  {timing.cache_hit ? 'Yes ✓' : 'No'}
                </span>
              </div>
              {timing.cache_source && (
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Source:</span>
                  <span>{timing.cache_source}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Status */}
          {timing.degraded && (
            <Card className='p-3 border-destructive'>
              <p className='font-medium text-xs text-destructive'>Degraded Mode</p>
              <p className='text-xs text-muted-foreground mt-1'>
                Service operating in degraded mode.
              </p>
            </Card>
          )}

          {/* Request ID */}
          <p className='text-[10px] text-muted-foreground'>
            Request ID: {timing.request_id}
          </p>
        </>
      ) : (
        <p className='text-sm text-muted-foreground'>
          Send a message to see timing data.
        </p>
      )}

      {/* Progress history */}
      {progressHistory.length > 0 && (
        <Card className='p-3'>
          <p className='font-medium text-xs mb-2'>Progress History</p>
          <div className='text-[10px] space-y-0.5 max-h-32 overflow-auto'>
            {progressHistory.map((step, i) => (
              <div key={i} className='flex items-center gap-1'>
                <span className='text-muted-foreground'>{i + 1}.</span>
                <span className='font-medium'>{step.substep || step.step}:</span>
                <span className='text-muted-foreground'>{step.message}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
