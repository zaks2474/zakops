/**
 * Auto-generated TypeScript types from OpenAPI specification.
 * Generated from: ZakOps API v1.0.0
 * DO NOT EDIT MANUALLY
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ActionApprove = {
  approved_by?: string;
  notes?: string | null;
};

export type ActionReject = {
  rejected_by?: string;
  reason: string;
};

export type ActionResponse = {
  action_id: string;
  deal_id: string | null;
  capability_id: string;
  action_type: string;
  title: string;
  summary: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  risk_level: string;
  requires_human_review: boolean;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  deal_name?: string | null;
  deal_stage?: string | null;
};

export type DealCreate = {
  canonical_name: string;
  display_name?: string | null;
  folder_path?: string | null;
  stage?: string;
  status?: string;
  identifiers?: Record<string, unknown> | null;
  company_info?: Record<string, unknown> | null;
  broker?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type DealEvent = {
  id: number;
  deal_id: string;
  event_type: string;
  source: string;
  actor: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type DealResponse = {
  deal_id: string;
  canonical_name: string;
  display_name: string | null;
  folder_path: string | null;
  stage: string;
  status: string;
  identifiers: Record<string, unknown>;
  company_info: Record<string, unknown>;
  broker: Record<string, unknown>;
  metadata: Record<string, unknown>;
  email_thread_ids: string[];
  created_at: string;
  updated_at: string;
  days_since_update?: number | null;
  action_count?: number | null;
  alias_count?: number | null;
};

export type DealUpdate = {
  canonical_name?: string | null;
  display_name?: string | null;
  folder_path?: string | null;
  stage?: string | null;
  status?: string | null;
  identifiers?: Record<string, unknown> | null;
  company_info?: Record<string, unknown> | null;
  broker?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type HTTPValidationError = {
  detail?: ValidationError[];
};

/** Login request body. */
export type LoginRequest = {
  email: string;
  password: string;
};

/** Login response model. */
export type LoginResponse = {
  message: string;
  operator: OperatorResponse;
};

/** Logout response model. */
export type LogoutResponse = {
  message: string;
};

/** Operator response model. */
export type OperatorResponse = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type PipelineSummary = {
  stage: string;
  count: number;
  avg_days_in_stage: number | null;
};

export type QuarantineProcess = {
  action: string;
  processed_by?: string;
  deal_id?: string | null;
  notes?: string | null;
};

export type QuarantineResponse = {
  id: string;
  message_id: string | null;
  email_subject: string | null;
  sender: string | null;
  sender_domain: string | null;
  received_at: string | null;
  classification: string;
  urgency: string;
  confidence: number | null;
  company_name: string | null;
  broker_name: string | null;
  status: string;
  created_at: string;
  sender_name?: string | null;
  sender_company?: string | null;
  is_broker?: boolean | null;
};

/** Registration request body. */
export type RegisterRequest = {
  email: string;
  password: string;
  name: string;
};

export type RunCreate = {
  input_message: string;
  assistant_id?: string | null;
  metadata?: Record<string, unknown> | null;
  stream?: boolean;
};

export type ThreadCreate = {
  assistant_id: string;
  deal_id?: string | null;
  user_id?: string | null;
  metadata?: Record<string, unknown> | null;
  user_context?: Record<string, unknown> | null;
};

export type ToolCallApprove = {
  approved_by?: string;
};

export type ToolCallReject = {
  rejected_by?: string;
  reason: string;
};

export type ValidationError = {
  loc: string | number[];
  msg: string;
  type: string;
};

export type ErrorResponse = {
  error?: {
    code: string;
    message: string;
    details?: {
      field?: string;
      message?: string;
      code?: string;
    }[];
    trace_id?: string;
    timestamp?: string;
  };
  meta?: ResponseMeta;
};

export type ResponseMeta = {
  trace_id: string;
  correlation_id?: string;
  timestamp: string;
};

export type SuccessResponse = {
  data?: unknown;
  meta?: ResponseMeta;
};

export type ListResponse = {
  data?: unknown[];
  meta?: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    trace_id: string;
    timestamp?: string;
  };
};

export type PaginatedResponse = {
  data?: Record<string, unknown>[];
  meta?: ResponseMeta;
  pagination?: {
    total?: number;
    page?: number;
    per_page?: number;
    total_pages?: number;
  };
};

// API Endpoints

export interface ApiEndpoints {
  // POST /api/auth/login
  login_api_auth_login_post: {
    request: LoginRequest;
    response: LoginResponse;
  };
  // POST /api/auth/logout
  logout_api_auth_logout_post: {
    request: void;
    response: LogoutResponse;
  };
  // GET /api/auth/me
  get_current_user_api_auth_me_get: {
    request: void;
    response: OperatorResponse;
  };
  // POST /api/auth/register
  register_api_auth_register_post: {
    request: RegisterRequest;
    response: OperatorResponse;
  };
  // GET /api/auth/check
  check_auth_api_auth_check_get: {
    request: void;
    response: void;
  };
  // GET /health
  health_check_health_get: {
    request: void;
    response: Record<string, unknown>;
  };
  // GET /health/live
  liveness_check_health_live_get: {
    request: void;
    response: Record<string, string>;
  };
  // GET /health/ready
  readiness_check_health_ready_get: {
    request: void;
    response: Record<string, unknown>;
  };
  // GET /health/detailed
  detailed_health_check_health_detailed_get: {
    request: void;
    response: Record<string, unknown>;
  };
  // GET /api/deals
  list_deals_api_deals_get: {
    request: void;
    response: DealResponse[];
  };
  // POST /api/deals
  create_deal_api_deals_post: {
    request: DealCreate;
    response: DealResponse;
  };
  // GET /api/deals/{deal_id}
  get_deal_api_deals__deal_id__get: {
    request: void;
    response: DealResponse;
  };
  // PATCH /api/deals/{deal_id}
  update_deal_api_deals__deal_id__patch: {
    request: DealUpdate;
    response: DealResponse;
  };
  // GET /api/deals/{deal_id}/events
  get_deal_events_api_deals__deal_id__events_get: {
    request: void;
    response: DealEvent[];
  };
  // GET /api/deals/{deal_id}/aliases
  get_deal_aliases_api_deals__deal_id__aliases_get: {
    request: void;
    response: void;
  };
  // GET /api/actions
  list_actions_api_actions_get: {
    request: void;
    response: ActionResponse[];
  };
  // GET /api/actions/{action_id}
  get_action_api_actions__action_id__get: {
    request: void;
    response: ActionResponse;
  };
  // POST /api/actions/{action_id}/approve
  approve_action_api_actions__action_id__approve_post: {
    request: ActionApprove;
    response: void;
  };
  // POST /api/actions/{action_id}/reject
  reject_action_api_actions__action_id__reject_post: {
    request: ActionReject;
    response: void;
  };
  // GET /api/quarantine
  list_quarantine_api_quarantine_get: {
    request: void;
    response: QuarantineResponse[];
  };
  // GET /api/quarantine/{item_id}
  get_quarantine_item_api_quarantine__item_id__get: {
    request: void;
    response: QuarantineResponse;
  };
  // POST /api/quarantine/{item_id}/process
  process_quarantine_api_quarantine__item_id__process_post: {
    request: QuarantineProcess;
    response: void;
  };
  // GET /api/pipeline/summary
  get_pipeline_summary_api_pipeline_summary_get: {
    request: void;
    response: PipelineSummary[];
  };
  // GET /api/pipeline/stats
  get_pipeline_stats_api_pipeline_stats_get: {
    request: void;
    response: void;
  };
  // POST /api/threads
  api_create_thread_api_threads_post: {
    request: ThreadCreate;
    response: void;
  };
  // GET /api/threads/{thread_id}
  api_get_thread_api_threads__thread_id__get: {
    request: void;
    response: void;
  };
  // DELETE /api/threads/{thread_id}
  api_archive_thread_api_threads__thread_id__delete: {
    request: void;
    response: void;
  };
  // GET /api/threads/{thread_id}/runs
  api_list_runs_api_threads__thread_id__runs_get: {
    request: void;
    response: void;
  };
  // POST /api/threads/{thread_id}/runs
  api_create_run_api_threads__thread_id__runs_post: {
    request: RunCreate;
    response: void;
  };
  // POST /api/threads/{thread_id}/runs/stream
  api_create_and_stream_run_api_threads__thread_id__runs_stream_post: {
    request: RunCreate;
    response: void;
  };
  // GET /api/threads/{thread_id}/runs/{run_id}
  api_get_run_api_threads__thread_id__runs__run_id__get: {
    request: void;
    response: void;
  };
  // GET /api/threads/{thread_id}/runs/{run_id}/events
  api_get_run_events_api_threads__thread_id__runs__run_id__events_get: {
    request: void;
    response: void;
  };
  // GET /api/threads/{thread_id}/runs/{run_id}/stream
  api_stream_run_events_api_threads__thread_id__runs__run_id__stream_get: {
    request: void;
    response: void;
  };
  // GET /api/threads/{thread_id}/runs/{run_id}/tool_calls
  api_list_tool_calls_api_threads__thread_id__runs__run_id__tool_calls_get: {
    request: void;
    response: void;
  };
  // POST /api/threads/{thread_id}/runs/{run_id}/tool_calls/{tool_call_id}/approve
  api_approve_tool_call_api_threads__thread_id__runs__run_id__tool_calls__tool_call_id__approve_post: {
    request: ToolCallApprove;
    response: void;
  };
  // POST /api/threads/{thread_id}/runs/{run_id}/tool_calls/{tool_call_id}/reject
  api_reject_tool_call_api_threads__thread_id__runs__run_id__tool_calls__tool_call_id__reject_post: {
    request: ToolCallReject;
    response: void;
  };
  // GET /api/threads/{thread_id}/runs/{run_id}/tool_calls/{tool_call_id}
  api_get_tool_call_api_threads__thread_id__runs__run_id__tool_calls__tool_call_id__get: {
    request: void;
    response: void;
  };
  // GET /api/pending-tool-approvals
  api_pending_tool_approvals_api_pending_tool_approvals_get: {
    request: void;
    response: void;
  };
  // GET /api/senders
  list_senders_api_senders_get: {
    request: void;
    response: void;
  };
  // GET /api/senders/{email}
  get_sender_api_senders__email__get: {
    request: void;
    response: void;
  };
}

export const API_PATHS = {
  login_api_auth_login_post: '/api/auth/login',
  logout_api_auth_logout_post: '/api/auth/logout',
  get_current_user_api_auth_me_get: '/api/auth/me',
  register_api_auth_register_post: '/api/auth/register',
  check_auth_api_auth_check_get: '/api/auth/check',
  health_check_health_get: '/health',
  liveness_check_health_live_get: '/health/live',
  readiness_check_health_ready_get: '/health/ready',
  detailed_health_check_health_detailed_get: '/health/detailed',
  list_deals_api_deals_get: '/api/deals',
  create_deal_api_deals_post: '/api/deals',
  get_deal_api_deals__deal_id__get: '/api/deals/{deal_id}',
  update_deal_api_deals__deal_id__patch: '/api/deals/{deal_id}',
  get_deal_events_api_deals__deal_id__events_get: '/api/deals/{deal_id}/events',
  get_deal_aliases_api_deals__deal_id__aliases_get: '/api/deals/{deal_id}/aliases',
  list_actions_api_actions_get: '/api/actions',
  get_action_api_actions__action_id__get: '/api/actions/{action_id}',
  approve_action_api_actions__action_id__approve_post: '/api/actions/{action_id}/approve',
  reject_action_api_actions__action_id__reject_post: '/api/actions/{action_id}/reject',
  list_quarantine_api_quarantine_get: '/api/quarantine',
  get_quarantine_item_api_quarantine__item_id__get: '/api/quarantine/{item_id}',
  process_quarantine_api_quarantine__item_id__process_post: '/api/quarantine/{item_id}/process',
  get_pipeline_summary_api_pipeline_summary_get: '/api/pipeline/summary',
  get_pipeline_stats_api_pipeline_stats_get: '/api/pipeline/stats',
  api_create_thread_api_threads_post: '/api/threads',
  api_get_thread_api_threads__thread_id__get: '/api/threads/{thread_id}',
  api_archive_thread_api_threads__thread_id__delete: '/api/threads/{thread_id}',
  api_list_runs_api_threads__thread_id__runs_get: '/api/threads/{thread_id}/runs',
  api_create_run_api_threads__thread_id__runs_post: '/api/threads/{thread_id}/runs',
  api_create_and_stream_run_api_threads__thread_id__runs_stream_post: '/api/threads/{thread_id}/runs/stream',
  api_get_run_api_threads__thread_id__runs__run_id__get: '/api/threads/{thread_id}/runs/{run_id}',
  api_get_run_events_api_threads__thread_id__runs__run_id__events_get: '/api/threads/{thread_id}/runs/{run_id}/events',
  api_stream_run_events_api_threads__thread_id__runs__run_id__stream_get: '/api/threads/{thread_id}/runs/{run_id}/stream',
  api_list_tool_calls_api_threads__thread_id__runs__run_id__tool_calls_get: '/api/threads/{thread_id}/runs/{run_id}/tool_calls',
  api_approve_tool_call_api_threads__thread_id__runs__run_id__tool_calls__tool_call_id__approve_post: '/api/threads/{thread_id}/runs/{run_id}/tool_calls/{tool_call_id}/approve',
  api_reject_tool_call_api_threads__thread_id__runs__run_id__tool_calls__tool_call_id__reject_post: '/api/threads/{thread_id}/runs/{run_id}/tool_calls/{tool_call_id}/reject',
  api_get_tool_call_api_threads__thread_id__runs__run_id__tool_calls__tool_call_id__get: '/api/threads/{thread_id}/runs/{run_id}/tool_calls/{tool_call_id}',
  api_pending_tool_approvals_api_pending_tool_approvals_get: '/api/pending-tool-approvals',
  list_senders_api_senders_get: '/api/senders',
  get_sender_api_senders__email__get: '/api/senders/{email}',
} as const;
