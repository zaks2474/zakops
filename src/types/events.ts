/**
 * ZakOps Agent Event Types
 * =========================
 *
 * Shared event schema for agent and UI alignment.
 * Both the agent and UI must use the same event types.
 */

// =============================================================================
// EVENT TYPE ENUM
// =============================================================================

export const AGENT_EVENT_TYPES = {
  // Deal lifecycle
  DEAL_CREATED: 'deal.created',
  DEAL_UPDATED: 'deal.updated',
  DEAL_STAGE_CHANGED: 'deal.stage_changed',
  DEAL_SCORED: 'deal.scored',
  DEAL_ARCHIVED: 'deal.archived',

  // Actions
  ACTION_CREATED: 'action.created',
  ACTION_APPROVAL_REQUESTED: 'action.approval_requested',
  ACTION_APPROVED: 'action.approved',
  ACTION_REJECTED: 'action.rejected',
  ACTION_EXECUTING: 'action.executing',
  ACTION_COMPLETED: 'action.completed',
  ACTION_FAILED: 'action.failed',

  // Documents
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_EXTRACTED: 'document.extracted',
  DOCUMENT_INDEXED: 'document.indexed',
  DOCUMENT_ANALYZED: 'document.analyzed',

  // Quarantine
  QUARANTINE_CREATED: 'quarantine.created',
  QUARANTINE_CLASSIFIED: 'quarantine.classified',
  QUARANTINE_APPROVED: 'quarantine.approved',
  QUARANTINE_REJECTED: 'quarantine.rejected',

  // Agent lifecycle
  AGENT_RUN_STARTED: 'agent.run_started',
  AGENT_THINKING: 'agent.thinking',
  AGENT_TOOL_CALLED: 'agent.tool_called',
  AGENT_TOOL_COMPLETED: 'agent.tool_completed',
  AGENT_WAITING_APPROVAL: 'agent.waiting_approval',
  AGENT_RUN_COMPLETED: 'agent.run_completed',
  AGENT_RUN_FAILED: 'agent.run_failed',

  // Streaming
  STREAM_START: 'stream.start',
  STREAM_TOKEN: 'stream.token',
  STREAM_END: 'stream.end',
  STREAM_ERROR: 'stream.error',
} as const;

export type AgentEventType =
  (typeof AGENT_EVENT_TYPES)[keyof typeof AGENT_EVENT_TYPES];

// =============================================================================
// BASE EVENT INTERFACE
// =============================================================================

export interface BaseEvent {
  type: AgentEventType;
  timestamp: string; // ISO 8601
  runId?: string;
  threadId?: string;
  metadata?: {
    operatorId?: string;
    dealId?: string;
    actionId?: string;
    toolName?: string;
  };
}

// =============================================================================
// DEAL EVENTS
// =============================================================================

export interface DealCreatedEvent extends BaseEvent {
  type: 'deal.created';
  payload: {
    dealId: string;
    name: string;
    source: string;
    stage: string;
  };
}

export interface DealUpdatedEvent extends BaseEvent {
  type: 'deal.updated';
  payload: {
    dealId: string;
    changes: Array<{
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }>;
  };
}

export interface DealStageChangedEvent extends BaseEvent {
  type: 'deal.stage_changed';
  payload: {
    dealId: string;
    fromStage: string;
    toStage: string;
    changedBy: 'agent' | 'operator';
    reason: string;
  };
}

export interface DealScoredEvent extends BaseEvent {
  type: 'deal.scored';
  payload: {
    dealId: string;
    score: number;
    breakdown: Array<{
      criterion: string;
      score: number;
      matched: boolean;
    }>;
  };
}

export interface DealArchivedEvent extends BaseEvent {
  type: 'deal.archived';
  payload: {
    dealId: string;
    reason: string;
    archivedBy: string;
  };
}

// =============================================================================
// ACTION EVENTS
// =============================================================================

export interface ActionCreatedEvent extends BaseEvent {
  type: 'action.created';
  payload: {
    actionId: string;
    dealId?: string;
    actionType: string;
    title: string;
    requiresApproval: boolean;
  };
}

export interface ActionApprovalRequestedEvent extends BaseEvent {
  type: 'action.approval_requested';
  payload: {
    approvalId: string;
    toolCallId: string;
    toolName: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    preview: string;
    externalImpact: boolean;
    expiresAt: string;
  };
}

export interface ActionApprovedEvent extends BaseEvent {
  type: 'action.approved';
  payload: {
    approvalId: string;
    toolCallId: string;
    toolName: string;
    approvedBy: string;
    modifications?: Record<string, unknown>;
  };
}

export interface ActionRejectedEvent extends BaseEvent {
  type: 'action.rejected';
  payload: {
    approvalId: string;
    toolCallId: string;
    toolName: string;
    rejectedBy: string;
    reason?: string;
  };
}

export interface ActionExecutingEvent extends BaseEvent {
  type: 'action.executing';
  payload: {
    actionId: string;
    toolCallId?: string;
  };
}

export interface ActionCompletedEvent extends BaseEvent {
  type: 'action.completed';
  payload: {
    actionId?: string;
    toolCallId: string;
    toolName: string;
    approvedBy?: string;
    result?: unknown;
  };
}

export interface ActionFailedEvent extends BaseEvent {
  type: 'action.failed';
  payload: {
    actionId?: string;
    toolCallId?: string;
    error: string;
  };
}

// =============================================================================
// DOCUMENT EVENTS
// =============================================================================

export interface DocumentUploadedEvent extends BaseEvent {
  type: 'document.uploaded';
  payload: {
    documentId: string;
    dealId: string;
    filename: string;
    contentType: string;
    size: number;
  };
}

export interface DocumentExtractedEvent extends BaseEvent {
  type: 'document.extracted';
  payload: {
    documentId: string;
    dealId: string;
    extractedFields: Record<string, unknown>;
  };
}

export interface DocumentIndexedEvent extends BaseEvent {
  type: 'document.indexed';
  payload: {
    documentId: string;
    dealId: string;
    chunksCreated: number;
  };
}

export interface DocumentAnalyzedEvent extends BaseEvent {
  type: 'document.analyzed';
  payload: {
    documentId: string;
    dealId: string;
    analysisType: string;
    summary: string;
  };
}

// =============================================================================
// QUARANTINE EVENTS
// =============================================================================

export interface QuarantineCreatedEvent extends BaseEvent {
  type: 'quarantine.created';
  payload: {
    quarantineId: string;
    emailId: string;
    subject: string;
    sender: string;
    reason: string;
  };
}

export interface QuarantineClassifiedEvent extends BaseEvent {
  type: 'quarantine.classified';
  payload: {
    quarantineId: string;
    classification: string;
    confidence: number;
  };
}

export interface QuarantineApprovedEvent extends BaseEvent {
  type: 'quarantine.approved';
  payload: {
    quarantineId: string;
    dealId: string;
    approvedBy: string;
  };
}

export interface QuarantineRejectedEvent extends BaseEvent {
  type: 'quarantine.rejected';
  payload: {
    quarantineId: string;
    reason: string;
    rejectedBy: string;
  };
}

// =============================================================================
// AGENT LIFECYCLE EVENTS
// =============================================================================

export interface AgentRunStartedEvent extends BaseEvent {
  type: 'agent.run_started';
  payload: {
    runId: string;
    threadId: string;
    assistantId: string;
    input: string;
  };
}

export interface AgentThinkingEvent extends BaseEvent {
  type: 'agent.thinking';
  payload: {
    message?: string;
    progress?: number;
  };
}

export interface AgentToolCalledEvent extends BaseEvent {
  type: 'agent.tool_called';
  payload: {
    toolCallId: string;
    toolName: string;
    riskLevel: string;
    requiresApproval: boolean;
  };
}

export interface AgentToolCompletedEvent extends BaseEvent {
  type: 'agent.tool_completed';
  payload: {
    toolCallId: string;
    toolName: string;
    success: boolean;
    error?: string;
  };
}

export interface AgentWaitingApprovalEvent extends BaseEvent {
  type: 'agent.waiting_approval';
  payload: {
    approvalId: string;
    toolName: string;
    preview: string;
  };
}

export interface AgentRunCompletedEvent extends BaseEvent {
  type: 'agent.run_completed';
  payload: {
    runId: string;
    output?: string;
    toolCallCount: number;
    durationMs: number;
  };
}

export interface AgentRunFailedEvent extends BaseEvent {
  type: 'agent.run_failed';
  payload: {
    runId: string;
    error: string;
    failedAt: string;
  };
}

// =============================================================================
// STREAMING EVENTS
// =============================================================================

export interface StreamStartEvent extends BaseEvent {
  type: 'stream.start';
  payload: {
    runId: string;
  };
}

export interface StreamTokenEvent extends BaseEvent {
  type: 'stream.token';
  payload: {
    token: string;
    index: number;
  };
}

export interface StreamEndEvent extends BaseEvent {
  type: 'stream.end';
  payload: {
    runId: string;
    totalTokens: number;
  };
}

export interface StreamErrorEvent extends BaseEvent {
  type: 'stream.error';
  payload: {
    error: string;
  };
}

// =============================================================================
// UNION TYPE FOR ALL EVENTS
// =============================================================================

export type AgentEvent =
  // Deal events
  | DealCreatedEvent
  | DealUpdatedEvent
  | DealStageChangedEvent
  | DealScoredEvent
  | DealArchivedEvent
  // Action events
  | ActionCreatedEvent
  | ActionApprovalRequestedEvent
  | ActionApprovedEvent
  | ActionRejectedEvent
  | ActionExecutingEvent
  | ActionCompletedEvent
  | ActionFailedEvent
  // Document events
  | DocumentUploadedEvent
  | DocumentExtractedEvent
  | DocumentIndexedEvent
  | DocumentAnalyzedEvent
  // Quarantine events
  | QuarantineCreatedEvent
  | QuarantineClassifiedEvent
  | QuarantineApprovedEvent
  | QuarantineRejectedEvent
  // Agent events
  | AgentRunStartedEvent
  | AgentThinkingEvent
  | AgentToolCalledEvent
  | AgentToolCompletedEvent
  | AgentWaitingApprovalEvent
  | AgentRunCompletedEvent
  | AgentRunFailedEvent
  // Stream events
  | StreamStartEvent
  | StreamTokenEvent
  | StreamEndEvent
  | StreamErrorEvent
  // Fallback
  | BaseEvent;

// =============================================================================
// UI EVENT HANDLERS MAPPING
// =============================================================================

/**
 * Maps event types to React Query query keys that should be invalidated.
 * This ensures the UI stays in sync with backend state changes.
 */
export const EVENT_TO_QUERY_INVALIDATION: Record<AgentEventType, string[]> = {
  // Deal events
  'deal.created': ['deals'],
  'deal.updated': ['deals', 'deal'],
  'deal.stage_changed': ['deals', 'deal', 'pipeline'],
  'deal.scored': ['deal'],
  'deal.archived': ['deals'],

  // Action events
  'action.created': ['actions', 'pendingActions'],
  'action.approval_requested': ['actions', 'pendingApprovals', 'agentRuns'],
  'action.approved': ['actions', 'pendingApprovals'],
  'action.rejected': ['actions', 'pendingApprovals'],
  'action.executing': ['actions'],
  'action.completed': ['actions', 'deal'],
  'action.failed': ['actions'],

  // Document events
  'document.uploaded': ['documents', 'deal'],
  'document.extracted': ['documents', 'deal'],
  'document.indexed': ['documents'],
  'document.analyzed': ['documents', 'deal'],

  // Quarantine events
  'quarantine.created': ['quarantine'],
  'quarantine.classified': ['quarantine'],
  'quarantine.approved': ['quarantine', 'deals'],
  'quarantine.rejected': ['quarantine'],

  // Agent events
  'agent.run_started': ['agentRuns'],
  'agent.thinking': [], // No invalidation needed
  'agent.tool_called': ['agentRuns'],
  'agent.tool_completed': ['agentRuns'],
  'agent.waiting_approval': ['agentRuns', 'pendingApprovals'],
  'agent.run_completed': ['agentRuns'],
  'agent.run_failed': ['agentRuns'],

  // Stream events (no invalidation needed)
  'stream.start': [],
  'stream.token': [],
  'stream.end': [],
  'stream.error': [],
};

// =============================================================================
// EVENT TYPE GUARDS
// =============================================================================

export function isDealEvent(event: AgentEvent): event is
  | DealCreatedEvent
  | DealUpdatedEvent
  | DealStageChangedEvent
  | DealScoredEvent
  | DealArchivedEvent {
  return event.type.startsWith('deal.');
}

export function isActionEvent(event: AgentEvent): event is
  | ActionCreatedEvent
  | ActionApprovalRequestedEvent
  | ActionApprovedEvent
  | ActionRejectedEvent
  | ActionExecutingEvent
  | ActionCompletedEvent
  | ActionFailedEvent {
  return event.type.startsWith('action.');
}

export function isDocumentEvent(event: AgentEvent): event is
  | DocumentUploadedEvent
  | DocumentExtractedEvent
  | DocumentIndexedEvent
  | DocumentAnalyzedEvent {
  return event.type.startsWith('document.');
}

export function isQuarantineEvent(event: AgentEvent): event is
  | QuarantineCreatedEvent
  | QuarantineClassifiedEvent
  | QuarantineApprovedEvent
  | QuarantineRejectedEvent {
  return event.type.startsWith('quarantine.');
}

export function isAgentLifecycleEvent(event: AgentEvent): event is
  | AgentRunStartedEvent
  | AgentThinkingEvent
  | AgentToolCalledEvent
  | AgentToolCompletedEvent
  | AgentWaitingApprovalEvent
  | AgentRunCompletedEvent
  | AgentRunFailedEvent {
  return event.type.startsWith('agent.');
}

export function isStreamEvent(event: AgentEvent): event is
  | StreamStartEvent
  | StreamTokenEvent
  | StreamEndEvent
  | StreamErrorEvent {
  return event.type.startsWith('stream.');
}

// =============================================================================
// EVENT HELPERS
// =============================================================================

/**
 * Get query keys to invalidate for an event.
 */
export function getQueryKeysToInvalidate(
  eventType: AgentEventType
): string[] {
  return EVENT_TO_QUERY_INVALIDATION[eventType] || [];
}

/**
 * Create a base event with common fields.
 */
export function createBaseEvent(
  type: AgentEventType,
  metadata?: BaseEvent['metadata']
): Omit<BaseEvent, 'type'> & { type: AgentEventType } {
  return {
    type,
    timestamp: new Date().toISOString(),
    metadata,
  };
}

/**
 * Check if an event requires immediate UI update.
 */
export function requiresImmediateUpdate(event: AgentEvent): boolean {
  const immediateTypes: AgentEventType[] = [
    'action.approval_requested',
    'deal.stage_changed',
    'agent.waiting_approval',
    'quarantine.created',
  ];
  return immediateTypes.includes(event.type);
}

/**
 * Get event priority for UI display ordering.
 */
export function getEventPriority(event: AgentEvent): number {
  const priorities: Partial<Record<AgentEventType, number>> = {
    'action.approval_requested': 1,
    'agent.waiting_approval': 1,
    'action.failed': 2,
    'agent.run_failed': 2,
    'deal.stage_changed': 3,
    'action.completed': 4,
    'deal.created': 5,
  };
  return priorities[event.type] || 10;
}
