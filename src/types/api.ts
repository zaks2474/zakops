/**
 * ZakOps Orchestration API Types
 * Generated from PostgreSQL schema and FastAPI endpoints
 */

// =============================================================================
// DEAL TYPES
// =============================================================================

export type DealStage =
  | 'inbound'
  | 'screening'
  | 'qualified'
  | 'loi'
  | 'diligence'
  | 'closing'
  | 'portfolio'
  | 'junk'
  | 'archived';

export type DealStatus = 'active' | 'junk' | 'merged' | 'archived';

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

export type NdaStatus = 'none' | 'requested' | 'signed' | 'expired';

export interface DealIdentifiers {
  listing_ids: string[];
  broker_reference_ids: string[];
  bizbuysell_id: string | null;
  axial_id: string | null;
  internal_codes: string[];
}

export interface CompanyInfo {
  company_name: string | null;
  legal_entity: string | null;
  dba_names: string[];
  location: string | null;
  sector: string | null;
  franchise_system: string | null;
}

export interface BrokerInfo {
  broker_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  quality_rating: Priority;
  sectors: string[];
  domain: string | null;
}

export interface DealMetadata {
  priority: Priority;
  asking_price: number | null;
  ebitda: number | null;
  revenue: number | null;
  employees: number | null;
  nda_status: NdaStatus;
  cim_received: boolean;
  junk_reason: string | null;
}

export interface Deal {
  deal_id: string;
  canonical_name: string;
  display_name: string | null;
  folder_path: string | null;
  stage: DealStage;
  status: DealStatus;
  identifiers: DealIdentifiers;
  company_info: CompanyInfo;
  broker: BrokerInfo;
  metadata: DealMetadata;
  email_thread_ids: string[];
  created_at: string;
  updated_at: string;
  days_since_update?: number;
  action_count?: number;
  alias_count?: number;
}

export interface DealCreate {
  canonical_name: string;
  display_name?: string;
  folder_path?: string;
  stage?: DealStage;
  status?: DealStatus;
  identifiers?: Partial<DealIdentifiers>;
  company_info?: Partial<CompanyInfo>;
  broker?: Partial<BrokerInfo>;
  metadata?: Partial<DealMetadata>;
}

export interface DealUpdate {
  canonical_name?: string;
  display_name?: string;
  folder_path?: string;
  stage?: DealStage;
  status?: DealStatus;
  identifiers?: Partial<DealIdentifiers>;
  company_info?: Partial<CompanyInfo>;
  broker?: Partial<BrokerInfo>;
  metadata?: Partial<DealMetadata>;
}

export interface DealAlias {
  id: number;
  alias: string;
  alias_type: string;
  confidence: number;
  source: string;
  created_at: string;
}

export interface DealEvent {
  id: number;
  deal_id: string;
  event_type: string;
  source: string;
  actor: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

// =============================================================================
// ACTION TYPES
// =============================================================================

export type ActionStatus =
  | 'PENDING_APPROVAL'
  | 'QUEUED'
  | 'READY'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REJECTED';

export type RiskLevel = 'low' | 'medium' | 'high';

export type ActionSource = 'chat' | 'ui' | 'system' | 'agent' | 'api';

export interface Action {
  action_id: string;
  deal_id: string | null;
  capability_id: string;
  action_type: string;
  title: string;
  summary: string | null;
  status: ActionStatus;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  scheduled_for: string | null;
  duration_seconds: number | null;
  created_by: string;
  source: ActionSource;
  risk_level: RiskLevel;
  requires_human_review: boolean;
  idempotency_key: string | null;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  parent_action_id: string | null;
  root_action_id: string | null;
  chain_depth: number;
  audit_trail: AuditEntry[];
  artifacts: Artifact[];
  error_message: string | null;
  // Joined fields
  deal_name?: string;
  deal_stage?: DealStage;
}

export interface AuditEntry {
  action: string;
  by: string;
  at: string;
  notes?: string;
  reason?: string;
}

export interface Artifact {
  type: string;
  path: string;
  size?: number;
  created_at: string;
}

export interface ActionApprove {
  approved_by?: string;
  notes?: string;
}

export interface ActionReject {
  rejected_by?: string;
  reason: string;
}

// =============================================================================
// QUARANTINE TYPES
// =============================================================================

export type QuarantineClassification = 'DEAL_SIGNAL' | 'UNCERTAIN' | 'JUNK';

export type QuarantineStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface QuarantineItem {
  id: string;
  action_id: string | null;
  message_id: string | null;
  thread_id: string | null;
  email_subject: string | null;
  sender: string | null;
  sender_domain: string | null;
  received_at: string | null;
  classification: QuarantineClassification;
  urgency: Priority;
  confidence: number | null;
  company_name: string | null;
  broker_name: string | null;
  links: QuarantineLink[];
  quarantine_dir: string | null;
  email_content_path: string | null;
  triage_summary_path: string | null;
  status: QuarantineStatus;
  processed_at: string | null;
  processed_by: string | null;
  processing_result: string | null;
  created_deal_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  sender_name?: string;
  sender_company?: string;
  is_broker?: boolean;
}

export interface QuarantineLink {
  url: string;
  type: string;
  vendor_hint: string | null;
  auth_required: boolean;
  source_email_id: string;
  source_timestamp: string;
}

export interface QuarantineProcess {
  action: 'approve' | 'reject';
  processed_by?: string;
  deal_id?: string;
  notes?: string;
}

// =============================================================================
// SENDER PROFILE TYPES
// =============================================================================

export type SenderType = 'broker' | 'seller' | 'advisor' | 'platform' | 'unknown';

export interface SenderProfile {
  id: number;
  email: string;
  domain: string;
  name: string | null;
  company: string | null;
  role: string | null;
  sender_type: SenderType;
  quality_rating: Priority;
  is_broker: boolean;
  total_emails: number;
  deal_emails: number;
  last_email_at: string | null;
  associated_deal_ids: string[];
  created_at: string;
  updated_at: string;
}

// =============================================================================
// PIPELINE TYPES
// =============================================================================

export interface PipelineStageSummary {
  stage: DealStage;
  count: number;
  avg_days_in_stage: number | null;
}

export interface PipelineStats {
  total_active_deals: number;
  pending_actions: number;
  quarantine_pending: number;
  recent_events_24h: number;
  deals_by_stage: Record<DealStage, number>;
}

// =============================================================================
// STAGE TRANSITION TYPES
// =============================================================================

export interface StageTransitionRequest {
  new_stage: DealStage;
  reason?: string;
  idempotency_key?: string;
}

export interface StageTransitionResponse {
  deal_id: string;
  from_stage: DealStage;
  to_stage: DealStage;
  success: boolean;
  idempotent_hit: boolean;
}

export interface StageSummary {
  stage: DealStage;
  count: number;
  deals: Deal[];
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface ListParams {
  limit?: number;
  offset?: number;
}

export interface DealListParams extends ListParams {
  stage?: DealStage;
  status?: DealStatus;
  search?: string;
}

export interface ActionListParams extends ListParams {
  status?: ActionStatus;
  deal_id?: string;
  pending_only?: boolean;
}

export interface QuarantineListParams extends ListParams {
  status?: QuarantineStatus;
  classification?: QuarantineClassification;
}

export interface SenderListParams extends ListParams {
  is_broker?: boolean;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  database: 'connected' | 'disconnected';
  error?: string;
}

export interface ApprovalResponse {
  status: 'approved' | 'rejected';
  action_id: string;
}

export interface QuarantineProcessResponse {
  status: 'approved' | 'rejected';
  item_id: string;
  deal_id?: string;
}

// =============================================================================
// RE-EXPORT EXECUTION CONTRACTS
// =============================================================================

export {
  // Transition maps
  DEAL_TRANSITIONS,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_COLORS,
  ACTION_TRANSITIONS,
  ACTION_STATUS_LABELS,
  ACTION_STATUS_COLORS,
  ACTION_TERMINAL_STATUSES,
  QUARANTINE_TRANSITIONS,
  QUARANTINE_STATUS_LABELS,
  QUARANTINE_STATUS_COLORS,
  // Tool manifest
  TOOL_MANIFEST,
  // Validation functions
  isValidDealTransition,
  getValidDealTransitions,
  isValidActionTransition,
  isActionTerminal,
  isValidQuarantineTransition,
  getToolRiskLevel,
  toolRequiresApproval,
  getToolsByRiskLevel,
  generateIdempotencyKey,
  // Type guards
  isAgentRunEvent,
  isAgentToolCallEvent,
  isAgentStreamEvent,
} from './execution-contracts';

export type {
  // Agent event types
  AgentRunEventType,
  AgentToolEventType,
  AgentStreamEventType,
  AgentEventType,
  AgentEventBase,
  AgentRunEvent,
  AgentToolCallEvent,
  AgentStreamEvent,
  AgentEvent,
  // Tool types
  ToolRiskLevel,
  ToolManifestEntry,
  // Thread/Run types
  ThreadStatus,
  RunStatus,
  AgentThread,
  AgentRun,
  AgentToolCall,
} from './execution-contracts';
