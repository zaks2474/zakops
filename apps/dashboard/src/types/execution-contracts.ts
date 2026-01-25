/**
 * ZakOps Execution Model Contracts
 * Phase 1: State machines, transitions, agent events, and tool manifests
 *
 * These contracts define the valid state transitions and event types
 * for the Deal Lifecycle OS execution engine.
 */

import type { DealStage, ActionStatus, QuarantineStatus, RiskLevel } from './api';

// =============================================================================
// DEAL STAGE TRANSITIONS
// =============================================================================

/**
 * Valid deal stage transitions.
 * Key = current stage, Value = array of valid target stages
 *
 * Business rules:
 * - Forward progression through pipeline stages
 * - Any stage can transition to junk or archived
 * - junk can be restored to inbound for re-evaluation
 * - archived is terminal (soft delete)
 */
export const DEAL_TRANSITIONS: Record<DealStage, readonly DealStage[]> = {
  inbound: ['screening', 'junk', 'archived'],
  screening: ['qualified', 'junk', 'archived'],
  qualified: ['loi', 'junk', 'archived'],
  loi: ['diligence', 'qualified', 'junk', 'archived'], // Can fall back to qualified
  diligence: ['closing', 'loi', 'junk', 'archived'], // Can fall back to loi
  closing: ['portfolio', 'diligence', 'junk', 'archived'], // Can fall back to diligence
  portfolio: ['archived'], // Only archive from portfolio
  junk: ['inbound', 'archived'], // Can restore to inbound for re-evaluation
  archived: [], // Terminal state - no transitions out
} as const;

/**
 * Human-readable labels for deal stages
 */
export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  inbound: 'Inbound',
  screening: 'Screening',
  qualified: 'Qualified',
  loi: 'LOI',
  diligence: 'Diligence',
  closing: 'Closing',
  portfolio: 'Portfolio',
  junk: 'Junk',
  archived: 'Archived',
} as const;

/**
 * Stage colors for UI display
 */
export const DEAL_STAGE_COLORS: Record<DealStage, string> = {
  inbound: 'blue',
  screening: 'cyan',
  qualified: 'green',
  loi: 'yellow',
  diligence: 'orange',
  closing: 'purple',
  portfolio: 'emerald',
  junk: 'gray',
  archived: 'slate',
} as const;

/**
 * Check if a deal stage transition is valid
 */
export function isValidDealTransition(from: DealStage, to: DealStage): boolean {
  return DEAL_TRANSITIONS[from].includes(to);
}

/**
 * Get valid next stages for a deal
 */
export function getValidDealTransitions(stage: DealStage): readonly DealStage[] {
  return DEAL_TRANSITIONS[stage];
}

// =============================================================================
// ACTION STATUS MACHINE
// =============================================================================

/**
 * Valid action status transitions.
 * Key = current status, Value = array of valid target statuses
 *
 * Flow:
 * PENDING_APPROVAL -> QUEUED (approved) | REJECTED (rejected)
 * QUEUED -> READY (executor picks up)
 * READY -> RUNNING (execution starts)
 * RUNNING -> COMPLETED | FAILED | CANCELLED
 * FAILED -> QUEUED (retry) | CANCELLED (give up)
 */
export const ACTION_TRANSITIONS: Record<ActionStatus, readonly ActionStatus[]> = {
  PENDING_APPROVAL: ['QUEUED', 'REJECTED', 'CANCELLED'],
  QUEUED: ['READY', 'CANCELLED'],
  READY: ['RUNNING', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [], // Terminal state
  FAILED: ['QUEUED', 'CANCELLED'], // Can retry (goes back to QUEUED)
  CANCELLED: [], // Terminal state
  REJECTED: [], // Terminal state
} as const;

/**
 * Human-readable labels for action statuses
 */
export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  PENDING_APPROVAL: 'Pending Approval',
  QUEUED: 'Queued',
  READY: 'Ready',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
} as const;

/**
 * Status colors for UI display
 */
export const ACTION_STATUS_COLORS: Record<ActionStatus, string> = {
  PENDING_APPROVAL: 'yellow',
  QUEUED: 'blue',
  READY: 'cyan',
  RUNNING: 'purple',
  COMPLETED: 'green',
  FAILED: 'red',
  CANCELLED: 'gray',
  REJECTED: 'orange',
} as const;

/**
 * Terminal statuses (no further transitions)
 */
export const ACTION_TERMINAL_STATUSES: readonly ActionStatus[] = [
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REJECTED',
] as const;

/**
 * Check if an action status transition is valid
 */
export function isValidActionTransition(from: ActionStatus, to: ActionStatus): boolean {
  return ACTION_TRANSITIONS[from].includes(to);
}

/**
 * Check if an action is in a terminal state
 */
export function isActionTerminal(status: ActionStatus): boolean {
  return ACTION_TERMINAL_STATUSES.includes(status);
}

// =============================================================================
// QUARANTINE LIFECYCLE
// =============================================================================

/**
 * Valid quarantine status transitions.
 *
 * Flow:
 * pending -> approved (create deal) | rejected (discard) | expired (timeout)
 * All end states are terminal
 */
export const QUARANTINE_TRANSITIONS: Record<QuarantineStatus, readonly QuarantineStatus[]> = {
  pending: ['approved', 'rejected', 'expired'],
  approved: [], // Terminal - deal was created
  rejected: [], // Terminal - item discarded
  expired: ['pending'], // Can be re-queued for review
} as const;

/**
 * Human-readable labels for quarantine statuses
 */
export const QUARANTINE_STATUS_LABELS: Record<QuarantineStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
} as const;

/**
 * Status colors for UI display
 */
export const QUARANTINE_STATUS_COLORS: Record<QuarantineStatus, string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  expired: 'gray',
} as const;

/**
 * Check if a quarantine status transition is valid
 */
export function isValidQuarantineTransition(from: QuarantineStatus, to: QuarantineStatus): boolean {
  return QUARANTINE_TRANSITIONS[from].includes(to);
}

// =============================================================================
// AGENT EVENT TYPES
// =============================================================================

/**
 * Agent run lifecycle events
 */
export type AgentRunEventType =
  | 'run_created'
  | 'run_started'
  | 'run_completed'
  | 'run_failed'
  | 'run_cancelled';

/**
 * Agent tool execution events
 */
export type AgentToolEventType =
  | 'tool_call_started'
  | 'tool_call_completed'
  | 'tool_call_failed'
  | 'tool_approval_required'
  | 'tool_approval_granted'
  | 'tool_approval_denied';

/**
 * Agent streaming events (from LangSmith)
 */
export type AgentStreamEventType =
  | 'stream_start'
  | 'stream_token'
  | 'stream_end'
  | 'stream_error';

/**
 * All agent event types
 */
export type AgentEventType =
  | AgentRunEventType
  | AgentToolEventType
  | AgentStreamEventType;

/**
 * Base interface for all agent events
 */
export interface AgentEventBase {
  event_id: string;
  event_type: AgentEventType;
  thread_id: string;
  run_id: string;
  timestamp: string;
}

/**
 * Run lifecycle event
 */
export interface AgentRunEvent extends AgentEventBase {
  event_type: AgentRunEventType;
  data: {
    assistant_id: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    error?: string;
    duration_ms?: number;
  };
}

/**
 * Tool call event
 */
export interface AgentToolCallEvent extends AgentEventBase {
  event_type: AgentToolEventType;
  data: {
    tool_call_id: string;
    tool_name: string;
    tool_input: Record<string, unknown>;
    tool_output?: unknown;
    risk_level: RiskLevel | 'critical';
    requires_approval: boolean;
    approved_by?: string;
    error?: string;
    duration_ms?: number;
  };
}

/**
 * Streaming token event
 */
export interface AgentStreamEvent extends AgentEventBase {
  event_type: AgentStreamEventType;
  data: {
    token?: string;
    content?: string;
    error?: string;
  };
}

/**
 * Union of all agent events
 */
export type AgentEvent = AgentRunEvent | AgentToolCallEvent | AgentStreamEvent;

// =============================================================================
// TOOL RISK MANIFEST
// =============================================================================

/**
 * Extended risk level including critical
 */
export type ToolRiskLevel = RiskLevel | 'critical';

/**
 * Tool definition with risk classification
 */
export interface ToolManifestEntry {
  tool_id: string;
  name: string;
  description: string;
  risk_level: ToolRiskLevel;
  requires_approval: boolean;
  allowed_deal_stages?: DealStage[];
  rate_limit?: {
    max_calls: number;
    window_seconds: number;
  };
}

/**
 * ZakOps tool manifest with risk classifications
 * Based on Agent Bridge MCP tools inventory
 */
export const TOOL_MANIFEST: Record<string, ToolManifestEntry> = {
  // Low risk - read-only operations
  zakops_list_deals: {
    tool_id: 'zakops_list_deals',
    name: 'List Deals',
    description: 'List deals with optional filters',
    risk_level: 'low',
    requires_approval: false,
  },
  zakops_get_deal: {
    tool_id: 'zakops_get_deal',
    name: 'Get Deal',
    description: 'Get deal details with filesystem enrichments',
    risk_level: 'medium',
    requires_approval: false,
  },
  zakops_list_deal_artifacts: {
    tool_id: 'zakops_list_deal_artifacts',
    name: 'List Deal Artifacts',
    description: 'List files in deal folder',
    risk_level: 'low',
    requires_approval: false,
  },
  zakops_list_quarantine: {
    tool_id: 'zakops_list_quarantine',
    name: 'List Quarantine',
    description: 'List quarantine items with filters',
    risk_level: 'low',
    requires_approval: false,
  },
  zakops_get_action: {
    tool_id: 'zakops_get_action',
    name: 'Get Action',
    description: 'Get action status and details',
    risk_level: 'low',
    requires_approval: false,
  },
  zakops_list_actions: {
    tool_id: 'zakops_list_actions',
    name: 'List Actions',
    description: 'List actions with filters',
    risk_level: 'low',
    requires_approval: false,
  },
  rag_query_local: {
    tool_id: 'rag_query_local',
    name: 'RAG Query',
    description: 'Search local RAG index',
    risk_level: 'low',
    requires_approval: false,
  },

  // Medium risk - data retrieval with potential side effects
  rag_reindex_deal: {
    tool_id: 'rag_reindex_deal',
    name: 'Reindex Deal',
    description: 'Trigger RAG reindex for a deal',
    risk_level: 'medium',
    requires_approval: false,
  },

  // High risk - write operations requiring approval
  zakops_update_deal_profile: {
    tool_id: 'zakops_update_deal_profile',
    name: 'Update Deal Profile',
    description: 'Atomic write to deal_profile.json',
    risk_level: 'high',
    requires_approval: true,
  },
  zakops_write_deal_artifact: {
    tool_id: 'zakops_write_deal_artifact',
    name: 'Write Deal Artifact',
    description: 'Write files to deal folders',
    risk_level: 'high',
    requires_approval: true,
  },
  zakops_create_action: {
    tool_id: 'zakops_create_action',
    name: 'Create Action',
    description: 'Create approval-gated action',
    risk_level: 'high',
    requires_approval: true,
  },
  zakops_approve_quarantine: {
    tool_id: 'zakops_approve_quarantine',
    name: 'Approve Quarantine',
    description: 'Approve quarantine item and create deal',
    risk_level: 'high',
    requires_approval: true,
  },
} as const;

/**
 * Get tool risk level
 */
export function getToolRiskLevel(toolName: string): ToolRiskLevel {
  return TOOL_MANIFEST[toolName]?.risk_level ?? 'high';
}

/**
 * Check if tool requires human approval
 */
export function toolRequiresApproval(toolName: string): boolean {
  return TOOL_MANIFEST[toolName]?.requires_approval ?? true;
}

/**
 * Get all tools by risk level
 */
export function getToolsByRiskLevel(riskLevel: ToolRiskLevel): ToolManifestEntry[] {
  return Object.values(TOOL_MANIFEST).filter((t) => t.risk_level === riskLevel);
}

// =============================================================================
// IDEMPOTENCY KEY GENERATION
// =============================================================================

/**
 * Generate a stable idempotency key for actions.
 * IMPORTANT: Does NOT include timestamps to ensure retry safety.
 *
 * Pattern: {deal_id}:{action_type}:{content_hash}
 */
export function generateIdempotencyKey(
  dealId: string | null,
  actionType: string,
  inputs: Record<string, unknown>
): string {
  const normalizedInputs = JSON.stringify(inputs, Object.keys(inputs).sort());
  const hash = simpleHash(normalizedInputs);
  const prefix = dealId ?? 'global';
  return `${prefix}:${actionType}:${hash}`;
}

/**
 * Simple string hash for idempotency keys.
 * Not cryptographic - just for uniqueness.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// =============================================================================
// AGENT THREAD/RUN TYPES
// =============================================================================

/**
 * Agent thread status
 */
export type ThreadStatus = 'active' | 'archived';

/**
 * Agent run status
 */
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Agent thread - conversation context
 */
export interface AgentThread {
  thread_id: string;
  deal_id: string | null;
  assistant_id: string;
  status: ThreadStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Agent run - single execution within a thread
 */
export interface AgentRun {
  run_id: string;
  thread_id: string;
  assistant_id: string;
  status: RunStatus;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  tool_calls: AgentToolCall[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Tool call within a run
 */
export interface AgentToolCall {
  tool_call_id: string;
  run_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: unknown | null;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  created_at: string;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isAgentRunEvent(event: AgentEvent): event is AgentRunEvent {
  return [
    'run_created',
    'run_started',
    'run_completed',
    'run_failed',
    'run_cancelled',
  ].includes(event.event_type);
}

export function isAgentToolCallEvent(event: AgentEvent): event is AgentToolCallEvent {
  return [
    'tool_call_started',
    'tool_call_completed',
    'tool_call_failed',
    'tool_approval_required',
    'tool_approval_granted',
    'tool_approval_denied',
  ].includes(event.event_type);
}

export function isAgentStreamEvent(event: AgentEvent): event is AgentStreamEvent {
  return [
    'stream_start',
    'stream_token',
    'stream_end',
    'stream_error',
  ].includes(event.event_type);
}
