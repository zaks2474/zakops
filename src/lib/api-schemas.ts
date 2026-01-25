/**
 * ZakOps Orchestration API Zod Schemas
 * Runtime validation for API data
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const DealStageSchema = z.enum([
  'inbound',
  'screening',
  'qualified',
  'loi',
  'diligence',
  'closing',
  'portfolio',
  'junk',
  'archived',
]);

export const DealStatusSchema = z.enum(['active', 'junk', 'merged', 'archived']);

export const PrioritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);

export const NdaStatusSchema = z.enum(['none', 'requested', 'signed', 'expired']);

export const ActionStatusSchema = z.enum([
  'PENDING_APPROVAL',
  'QUEUED',
  'READY',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REJECTED',
]);

export const RiskLevelSchema = z.enum(['low', 'medium', 'high']);

export const ActionSourceSchema = z.enum(['chat', 'ui', 'system', 'agent', 'api']);

export const QuarantineClassificationSchema = z.enum(['DEAL_SIGNAL', 'UNCERTAIN', 'JUNK']);

export const QuarantineStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired']);

export const SenderTypeSchema = z.enum(['broker', 'seller', 'advisor', 'platform', 'unknown']);

// =============================================================================
// NESTED SCHEMAS
// =============================================================================

export const DealIdentifiersSchema = z.object({
  listing_ids: z.array(z.string()),
  broker_reference_ids: z.array(z.string()),
  bizbuysell_id: z.string().nullable(),
  axial_id: z.string().nullable(),
  internal_codes: z.array(z.string()),
});

export const CompanyInfoSchema = z.object({
  company_name: z.string().nullable(),
  legal_entity: z.string().nullable(),
  dba_names: z.array(z.string()),
  location: z.string().nullable(),
  sector: z.string().nullable(),
  franchise_system: z.string().nullable(),
});

export const BrokerInfoSchema = z.object({
  broker_id: z.string().nullable(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  quality_rating: PrioritySchema,
  sectors: z.array(z.string()),
  domain: z.string().nullable(),
});

export const DealMetadataSchema = z.object({
  priority: PrioritySchema,
  asking_price: z.number().nullable(),
  ebitda: z.number().nullable(),
  revenue: z.number().nullable(),
  employees: z.number().nullable(),
  nda_status: NdaStatusSchema,
  cim_received: z.boolean(),
  junk_reason: z.string().nullable(),
});

export const AuditEntrySchema = z.object({
  action: z.string(),
  by: z.string(),
  at: z.string(),
  notes: z.string().optional(),
  reason: z.string().optional(),
});

export const ArtifactSchema = z.object({
  type: z.string(),
  path: z.string(),
  size: z.number().optional(),
  created_at: z.string(),
});

export const QuarantineLinkSchema = z.object({
  url: z.string(),
  type: z.string(),
  vendor_hint: z.string().nullable(),
  auth_required: z.boolean(),
  source_email_id: z.string(),
  source_timestamp: z.string(),
});

// =============================================================================
// MAIN ENTITY SCHEMAS
// =============================================================================

export const DealSchema = z.object({
  deal_id: z.string(),
  canonical_name: z.string(),
  display_name: z.string().nullable(),
  folder_path: z.string().nullable(),
  stage: DealStageSchema,
  status: DealStatusSchema,
  identifiers: DealIdentifiersSchema,
  company_info: CompanyInfoSchema,
  broker: BrokerInfoSchema,
  metadata: DealMetadataSchema,
  email_thread_ids: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
  days_since_update: z.number().optional(),
  action_count: z.number().optional(),
  alias_count: z.number().optional(),
});

export const DealCreateSchema = z.object({
  canonical_name: z.string().min(1),
  display_name: z.string().optional(),
  folder_path: z.string().optional(),
  stage: DealStageSchema.optional(),
  status: DealStatusSchema.optional(),
  identifiers: DealIdentifiersSchema.partial().optional(),
  company_info: CompanyInfoSchema.partial().optional(),
  broker: BrokerInfoSchema.partial().optional(),
  metadata: DealMetadataSchema.partial().optional(),
});

export const DealUpdateSchema = z.object({
  canonical_name: z.string().min(1).optional(),
  display_name: z.string().optional(),
  folder_path: z.string().optional(),
  stage: DealStageSchema.optional(),
  status: DealStatusSchema.optional(),
  identifiers: DealIdentifiersSchema.partial().optional(),
  company_info: CompanyInfoSchema.partial().optional(),
  broker: BrokerInfoSchema.partial().optional(),
  metadata: DealMetadataSchema.partial().optional(),
});

export const DealEventSchema = z.object({
  id: z.number(),
  deal_id: z.string(),
  event_type: z.string(),
  source: z.string(),
  actor: z.string().nullable(),
  details: z.record(z.unknown()),
  created_at: z.string(),
});

export const DealAliasSchema = z.object({
  id: z.number(),
  alias: z.string(),
  alias_type: z.string(),
  confidence: z.number(),
  source: z.string(),
  created_at: z.string(),
});

export const ActionSchema = z.object({
  action_id: z.string(),
  deal_id: z.string().nullable(),
  capability_id: z.string(),
  action_type: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  status: ActionStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  scheduled_for: z.string().nullable(),
  duration_seconds: z.number().nullable(),
  created_by: z.string(),
  source: ActionSourceSchema,
  risk_level: RiskLevelSchema,
  requires_human_review: z.boolean(),
  idempotency_key: z.string().nullable(),
  inputs: z.record(z.unknown()),
  outputs: z.record(z.unknown()),
  retry_count: z.number(),
  max_retries: z.number(),
  next_retry_at: z.string().nullable(),
  parent_action_id: z.string().nullable(),
  root_action_id: z.string().nullable(),
  chain_depth: z.number(),
  audit_trail: z.array(AuditEntrySchema),
  artifacts: z.array(ArtifactSchema),
  error_message: z.string().nullable(),
  deal_name: z.string().optional(),
  deal_stage: DealStageSchema.optional(),
});

export const ActionApproveSchema = z.object({
  approved_by: z.string().optional(),
  notes: z.string().optional(),
});

export const ActionRejectSchema = z.object({
  rejected_by: z.string().optional(),
  reason: z.string().min(1),
});

export const QuarantineItemSchema = z.object({
  id: z.string(),
  action_id: z.string().nullable(),
  message_id: z.string().nullable(),
  thread_id: z.string().nullable(),
  email_subject: z.string().nullable(),
  sender: z.string().nullable(),
  sender_domain: z.string().nullable(),
  received_at: z.string().nullable(),
  classification: QuarantineClassificationSchema,
  urgency: PrioritySchema,
  confidence: z.number().nullable(),
  company_name: z.string().nullable(),
  broker_name: z.string().nullable(),
  links: z.array(QuarantineLinkSchema),
  quarantine_dir: z.string().nullable(),
  email_content_path: z.string().nullable(),
  triage_summary_path: z.string().nullable(),
  status: QuarantineStatusSchema,
  processed_at: z.string().nullable(),
  processed_by: z.string().nullable(),
  processing_result: z.string().nullable(),
  created_deal_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  sender_name: z.string().optional(),
  sender_company: z.string().optional(),
  is_broker: z.boolean().optional(),
});

export const QuarantineProcessSchema = z.object({
  action: z.enum(['approve', 'reject']),
  processed_by: z.string().optional(),
  deal_id: z.string().optional(),
  notes: z.string().optional(),
});

export const SenderProfileSchema = z.object({
  id: z.number(),
  email: z.string(),
  domain: z.string(),
  name: z.string().nullable(),
  company: z.string().nullable(),
  role: z.string().nullable(),
  sender_type: SenderTypeSchema,
  quality_rating: PrioritySchema,
  is_broker: z.boolean(),
  total_emails: z.number(),
  deal_emails: z.number(),
  last_email_at: z.string().nullable(),
  associated_deal_ids: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});

export const PipelineStageSummarySchema = z.object({
  stage: DealStageSchema,
  count: z.number(),
  avg_days_in_stage: z.number().nullable(),
});

export const PipelineStatsSchema = z.object({
  total_active_deals: z.number(),
  pending_actions: z.number(),
  quarantine_pending: z.number(),
  recent_events_24h: z.number(),
  deals_by_stage: z.record(DealStageSchema, z.number()),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type DealStage = z.infer<typeof DealStageSchema>;
export type DealStatus = z.infer<typeof DealStatusSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type NdaStatus = z.infer<typeof NdaStatusSchema>;
export type ActionStatus = z.infer<typeof ActionStatusSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type ActionSource = z.infer<typeof ActionSourceSchema>;
export type QuarantineClassification = z.infer<typeof QuarantineClassificationSchema>;
export type QuarantineStatus = z.infer<typeof QuarantineStatusSchema>;
export type SenderType = z.infer<typeof SenderTypeSchema>;
export type Deal = z.infer<typeof DealSchema>;
export type DealCreate = z.infer<typeof DealCreateSchema>;
export type DealUpdate = z.infer<typeof DealUpdateSchema>;
export type DealEvent = z.infer<typeof DealEventSchema>;
export type DealAlias = z.infer<typeof DealAliasSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type ActionApprove = z.infer<typeof ActionApproveSchema>;
export type ActionReject = z.infer<typeof ActionRejectSchema>;
export type QuarantineItem = z.infer<typeof QuarantineItemSchema>;
export type QuarantineProcess = z.infer<typeof QuarantineProcessSchema>;
export type SenderProfile = z.infer<typeof SenderProfileSchema>;
export type PipelineStageSummary = z.infer<typeof PipelineStageSummarySchema>;
export type PipelineStats = z.infer<typeof PipelineStatsSchema>;

// =============================================================================
// EXECUTION CONTRACT SCHEMAS (Phase 1)
// =============================================================================

export const ToolRiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const AgentRunEventTypeSchema = z.enum([
  'run_created',
  'run_started',
  'run_completed',
  'run_failed',
  'run_cancelled',
]);

export const AgentToolEventTypeSchema = z.enum([
  'tool_call_started',
  'tool_call_completed',
  'tool_call_failed',
  'tool_approval_required',
  'tool_approval_granted',
  'tool_approval_denied',
]);

export const AgentStreamEventTypeSchema = z.enum([
  'stream_start',
  'stream_token',
  'stream_end',
  'stream_error',
]);

export const AgentEventTypeSchema = z.union([
  AgentRunEventTypeSchema,
  AgentToolEventTypeSchema,
  AgentStreamEventTypeSchema,
]);

export const ThreadStatusSchema = z.enum(['active', 'archived']);

export const RunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);

export const AgentEventBaseSchema = z.object({
  event_id: z.string(),
  event_type: AgentEventTypeSchema,
  thread_id: z.string(),
  run_id: z.string(),
  timestamp: z.string(),
});

export const AgentRunEventSchema = AgentEventBaseSchema.extend({
  event_type: AgentRunEventTypeSchema,
  data: z.object({
    assistant_id: z.string(),
    status: RunStatusSchema,
    error: z.string().optional(),
    duration_ms: z.number().optional(),
  }),
});

export const AgentToolCallEventSchema = AgentEventBaseSchema.extend({
  event_type: AgentToolEventTypeSchema,
  data: z.object({
    tool_call_id: z.string(),
    tool_name: z.string(),
    tool_input: z.record(z.unknown()),
    tool_output: z.unknown().optional(),
    risk_level: ToolRiskLevelSchema,
    requires_approval: z.boolean(),
    approved_by: z.string().optional(),
    error: z.string().optional(),
    duration_ms: z.number().optional(),
  }),
});

export const AgentStreamEventSchema = AgentEventBaseSchema.extend({
  event_type: AgentStreamEventTypeSchema,
  data: z.object({
    token: z.string().optional(),
    content: z.string().optional(),
    error: z.string().optional(),
  }),
});

export const AgentEventSchema = z.union([
  AgentRunEventSchema,
  AgentToolCallEventSchema,
  AgentStreamEventSchema,
]);

export const ToolCallStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'completed',
  'failed',
]);

export const AgentToolCallSchema = z.object({
  tool_call_id: z.string(),
  run_id: z.string(),
  tool_name: z.string(),
  tool_input: z.record(z.unknown()),
  tool_output: z.unknown().nullable(),
  status: ToolCallStatusSchema,
  requires_approval: z.boolean(),
  approved_by: z.string().nullable(),
  approved_at: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
});

export const AgentThreadSchema = z.object({
  thread_id: z.string(),
  deal_id: z.string().nullable(),
  assistant_id: z.string(),
  status: ThreadStatusSchema,
  metadata: z.record(z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

export const AgentRunSchema = z.object({
  run_id: z.string(),
  thread_id: z.string(),
  assistant_id: z.string(),
  status: RunStatusSchema,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  error: z.string().nullable(),
  tool_calls: z.array(AgentToolCallSchema),
  metadata: z.record(z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ToolManifestEntrySchema = z.object({
  tool_id: z.string(),
  name: z.string(),
  description: z.string(),
  risk_level: ToolRiskLevelSchema,
  requires_approval: z.boolean(),
  allowed_deal_stages: z.array(DealStageSchema).optional(),
  rate_limit: z
    .object({
      max_calls: z.number(),
      window_seconds: z.number(),
    })
    .optional(),
});

// Type exports for execution contracts
export type ToolRiskLevel = z.infer<typeof ToolRiskLevelSchema>;
export type AgentRunEventType = z.infer<typeof AgentRunEventTypeSchema>;
export type AgentToolEventType = z.infer<typeof AgentToolEventTypeSchema>;
export type AgentStreamEventType = z.infer<typeof AgentStreamEventTypeSchema>;
export type AgentEventType = z.infer<typeof AgentEventTypeSchema>;
export type ThreadStatus = z.infer<typeof ThreadStatusSchema>;
export type RunStatus = z.infer<typeof RunStatusSchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type AgentToolCall = z.infer<typeof AgentToolCallSchema>;
export type AgentThread = z.infer<typeof AgentThreadSchema>;
export type AgentRun = z.infer<typeof AgentRunSchema>;
export type ToolManifestEntry = z.infer<typeof ToolManifestEntrySchema>;
