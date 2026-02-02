/**
 * ZakOps API Client
 *
 * Centralized API client with Zod validation and response normalization.
 * All API calls MUST go through this module - no direct fetch in components.
 *
 * The frontend uses Next.js rewrites to proxy /api/* to the backend,
 * so we always call relative paths.
 */

import { z } from 'zod';

// ============================================================================
// Zod Schemas - Define expected response shapes
// ============================================================================

/**
 * Coerce a value to number, handling strings with currency symbols, commas, etc.
 * Returns null/undefined if the value cannot be parsed.
 * Logs warnings (not errors) for type coercions to aid debugging without alarming.
 */
function coerceToNumber(val: unknown): number | null | undefined {
  if (val === null) return null;
  if (val === undefined) return undefined;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val === 'string') {
    // Remove currency symbols, commas, whitespace
    const cleaned = val.replace(/[$,\s]/g, '').trim();
    if (cleaned === '' || cleaned === '-' || cleaned.toLowerCase() === 'tbd') {
      // Expected non-numeric values - don't log
      return null;
    }
    const num = parseFloat(cleaned);
    if (isNaN(num)) {
      // Unexpected string that couldn't be parsed - log as debug info
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[API] Coerced non-numeric string to null: "${val}"`);
      }
      return null;
    }
    return num;
  }
  return null;
}

// Schema for numeric fields that might arrive as strings
const coercedNumber = z.preprocess(coerceToNumber, z.number().nullable().optional());

/**
 * Coerce broker field to string. Backend may return:
 * - string: broker name directly
 * - object: { name?: string, email?: string, ... }
 * - null/undefined
 * We extract the name for display purposes.
 */
function coerceBrokerToString(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val || null;
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    // Extract name from broker object
    if (typeof obj.name === 'string' && obj.name) {
      return obj.name;
    }
    // Empty object {} returns null
    return null;
  }
  return null;
}

// Deal schema
export const DealSchema = z.object({
  deal_id: z.string(),
  canonical_name: z.string().nullable(),
  display_name: z.string().optional().nullable(),
  stage: z.string(),
  status: z.string(),
  broker: z.preprocess(coerceBrokerToString, z.string().nullable().optional()),
  priority: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  days_since_update: z.preprocess(coerceToNumber, z.number().optional()),
  folder_path: z.string().optional().nullable(),
});

export type Deal = z.infer<typeof DealSchema>;

// Deal detail schema (expanded)
export const DealDetailSchema = z.object({
  deal_id: z.string(),
  canonical_name: z.string().nullable(),
  display_name: z.string().nullable().optional(),
  folder_path: z.string().nullable().optional(),
  stage: z.string(),
  status: z.string(),
  broker: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    company: z.string().nullable(),
    phone: z.string().nullable(),
  }).nullable().optional(),
  company_info: z.object({
    sector: z.string().nullable().optional(),
    location: z.any().nullable().optional(),
  }).nullable().optional(),
  metadata: z.object({
    priority: z.string().nullable().optional(),
    asking_price: coercedNumber,
    ebitda: coercedNumber,
    revenue: coercedNumber,
    multiple: coercedNumber,
    nda_status: z.string().nullable().optional(),
    cim_received: z.boolean().nullable().optional(),
  }).passthrough().nullable().optional(),
  state_machine: z.object({
    current_stage: z.string(),
    is_terminal: z.boolean(),
    allowed_transitions: z.array(z.string()),
    advisory_context: z.string().nullable().optional(),
  }).nullable().optional(),
  case_file: z.any().nullable().optional(),
  event_count: z.number().optional(),
  pending_actions: z.number().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export type DealDetail = z.infer<typeof DealDetailSchema>;

// Deferred action schema
export const ActionSchema = z.object({
  action_id: z.string(),
  deal_id: z.string(),
  action_type: z.string(),
  scheduled_for: z.string(),
  status: z.string(),
  priority: z.string().optional(),
  is_due: z.boolean().optional(),
  data: z.any().optional(),
});

export type Action = z.infer<typeof ActionSchema>;

// Event schema
export const EventSchema = z.object({
  event_id: z.string(),
  event_type: z.string(),
  timestamp: z.string(),
  actor: z.string().nullable().optional(),
  data: z.any().optional(),
});

export type DealEvent = z.infer<typeof EventSchema>;

// Quarantine item schema
export const QuarantineItemSchema = z.object({
  id: z.string().optional(),
  quarantine_id: z.string().optional(),
  action_id: z.string().optional(),
  email_subject: z.string().optional(),
  subject: z.string().optional(),
  sender: z.string().optional(),
  from: z.string().optional(),
  received_at: z.string().optional(),
  timestamp: z.string().optional(),
  quarantine_reason: z.string().optional(),
  reason: z.string().optional(),
  status: z.string().optional(),
  classification: z.string().optional(),
  urgency: z.string().optional(),
  company: z.string().optional().nullable(),
  links: z.array(z.record(z.unknown())).optional(),
  attachments: z.array(z.record(z.unknown())).optional(),
  quarantine_dir: z.string().optional().nullable(),
  capability_id: z.string().optional().nullable(),
});

export type QuarantineItem = z.infer<typeof QuarantineItemSchema>;

// Quarantine health schema
export const QuarantineHealthSchema = z.object({
  status: z.string(),
  pending_items: z.number(),
  oldest_pending_days: z.number().optional(),
});

export type QuarantineHealth = z.infer<typeof QuarantineHealthSchema>;

// Quarantine preview schema (right-side panel)
export const QuarantinePreviewSchema = z.object({
  action_id: z.string(),
  status: z.string(),
  created_at: z.string().optional(),
  deal_id: z.string(),
  message_id: z.string().optional(),
  thread_id: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  received_at: z.string().optional(),
  subject: z.string().optional(),
  summary: z.array(z.string()).default([]),
  extracted_fields: z.record(z.unknown()).optional(),
  attachments: z.record(z.unknown()).optional(),
  links: z.record(z.unknown()).optional(),
  email: z.record(z.unknown()).optional(),
  quarantine_dir: z.string().nullish(),
  thread_resolution: z
    .object({
      thread_to_deal: z.string().nullish(),
      thread_to_non_deal: z.string().nullish(),
    })
    .nullish(),
}).passthrough();

export type QuarantinePreview = z.infer<typeof QuarantinePreviewSchema>;

// Deal materials (filesystem-backed correspondence bundles)
export const DealMaterialsSchema = z.object({
  deal_id: z.string(),
  deal_path: z.string(),
  correspondence: z.array(z.record(z.unknown())).default([]),
  aggregate_links: z.record(z.unknown()).optional(),
  pending_auth: z.array(z.record(z.unknown())).default([]),
}).passthrough();

export type DealMaterials = z.infer<typeof DealMaterialsSchema>;

// Alert schema
export const AlertSchema = z.object({
  type: z.string(),
  severity: z.string(),
  message: z.string(),
  deal_id: z.string().optional(),
  count: z.number().optional(),
  actions: z.array(z.string()).optional(),
});

export type Alert = z.infer<typeof AlertSchema>;

// Classification metrics schema
export const ClassificationMetricsSchema = z.object({
  decisions_24h: z.number().nullable().optional(),
  local_24h: z.number().nullable().optional(),
  cloud_24h: z.number().nullable().optional(),
  heuristic_24h: z.number().nullable().optional(),
  quarantine_rate: z.number().optional(),
});

export type ClassificationMetrics = z.infer<typeof ClassificationMetricsSchema>;

// Checkpoint schema
export const CheckpointSchema = z.object({
  id: z.string(),
  operation_type: z.string(),
  status: z.string(),
  progress: z.number().optional(),
});

export type Checkpoint = z.infer<typeof CheckpointSchema>;

// Pipeline stage schema
export const PipelineStageSchema = z.object({
  count: z.number(),
  deals: z.array(z.object({
    deal_id: z.string(),
    canonical_name: z.string().nullable(),
    days_in_stage: z.number(),
  })),
  avg_age: z.number(),
});

export type PipelineStage = z.infer<typeof PipelineStageSchema>;

// ============================================================================
// API Response Wrappers - Handle both wrapped and unwrapped responses
// ============================================================================

// Generic wrapper for paginated/counted responses
const DealsResponseSchema = z.object({
  count: z.number().optional(),
  deals: z.array(DealSchema),
}).or(z.array(DealSchema));

const ActionsResponseSchema = z.object({
  count: z.number().optional(),
  actions: z.array(ActionSchema),
}).or(z.array(ActionSchema));

const EventsResponseSchema = z.object({
  deal_id: z.string().optional(),
  count: z.number().optional(),
  events: z.array(EventSchema),
}).or(z.array(EventSchema));

const QuarantineResponseSchema = z.object({
  count: z.number().optional(),
  items: z.array(QuarantineItemSchema),
}).or(z.array(QuarantineItemSchema));

const AlertsResponseSchema = z.object({
  alert_count: z.number().optional(),
  alerts: z.array(AlertSchema),
}).or(z.array(AlertSchema));

const CheckpointsResponseSchema = z.array(CheckpointSchema);

const PipelineResponseSchema = z.object({
  total_active: z.number(),
  stages: z.record(PipelineStageSchema),
});

// ============================================================================
// API Error Handling
// ============================================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** User-friendly error message */
  get userMessage(): string {
    if (this.status === 0) {
      return `Network error connecting to API. Check if the backend is running.`;
    }
    if (this.status === 404) {
      return `Resource not found: ${this.endpoint}`;
    }
    if (this.status >= 500) {
      return `Server error (${this.status}). The API is having problems.`;
    }
    if (this.status === 401 || this.status === 403) {
      return `Access denied (${this.status}). You may not have permission.`;
    }
    return `API error ${this.status}: ${this.message}`;
  }
}

// ============================================================================
// Core Fetch Function
// ============================================================================

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ApiError(
        `API request failed: ${errorBody}`,
        response.status,
        endpoint
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      0,
      endpoint
    );
  }
}

// ============================================================================
// Normalized API Functions - Always return arrays where expected
// ============================================================================

/**
 * Fetch all deals - ALWAYS returns an array
 */
export async function getDeals(params?: {
  stage?: string;
  status?: string;
  broker?: string;
}): Promise<Deal[]> {
  const searchParams = new URLSearchParams();
  if (params?.stage) searchParams.set('stage', params.stage);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.broker) searchParams.set('broker', params.broker);

  const query = searchParams.toString();
  const endpoint = `/api/deals${query ? `?${query}` : ''}`;

  const data = await apiFetch<unknown>(endpoint);
  const parsed = DealsResponseSchema.safeParse(data);

  if (!parsed.success) {
    console.error('Invalid deals response:', parsed.error);
    return [];
  }

  // Normalize: extract array from wrapper or return as-is
  if (Array.isArray(parsed.data)) {
    return parsed.data;
  }
  return parsed.data.deals;
}

/**
 * Soft-delete (archive) a deal.
 * This is a UI-level delete only (keeps registry/events/materials intact).
 */
export async function archiveDeal(
  dealId: string,
  params?: { operator?: string; reason?: string }
): Promise<{ archived: boolean; deal_id: string }> {
  return apiFetch(`/api/deals/${encodeURIComponent(dealId)}/archive`, {
    method: 'POST',
    body: JSON.stringify({
      operator: params?.operator || 'operator',
      reason: params?.reason,
    }),
  });
}

/**
 * Soft-delete (archive) multiple deals.
 */
export async function bulkArchiveDeals(
  dealIds: string[],
  params?: { operator?: string; reason?: string }
): Promise<{ archived: string[]; skipped: string[] }> {
  return apiFetch(`/api/deals/bulk-archive`, {
    method: 'POST',
    body: JSON.stringify({
      deal_ids: dealIds,
      operator: params?.operator || 'operator',
      reason: params?.reason,
    }),
  });
}

/**
 * Fetch single deal detail
 * Returns partial data on validation errors (degrades gracefully)
 */
export async function getDeal(dealId: string): Promise<DealDetail | null> {
  try {
    const data = await apiFetch<unknown>(`/api/deals/${dealId}`);
    const parsed = DealDetailSchema.safeParse(data);

    if (!parsed.success) {
      // Log validation issues as debug info (not errors - this is expected behavior)
      if (process.env.NODE_ENV === 'development') {
        console.debug('[API] Deal schema validation notes:', parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', '));
      }

      // Try to return partial data - the API returned something, just not perfectly shaped
      // Use a more permissive schema as fallback
      const rawData = data as Record<string, unknown>;
      if (rawData && typeof rawData === 'object' && rawData.deal_id) {
        console.debug('[API] Returning partially validated deal data for:', rawData.deal_id);
        return {
          deal_id: String(rawData.deal_id),
          canonical_name: rawData.canonical_name ? String(rawData.canonical_name) : null,
          display_name: rawData.display_name ? String(rawData.display_name) : null,
          folder_path: rawData.folder_path ? String(rawData.folder_path) : null,
          stage: String(rawData.stage || 'unknown'),
          status: String(rawData.status || 'unknown'),
          broker: rawData.broker as DealDetail['broker'] || null,
          company_info: rawData.company_info as DealDetail['company_info'] || null,
          metadata: rawData.metadata as DealDetail['metadata'] || null,
          state_machine: rawData.state_machine as DealDetail['state_machine'] || null,
          case_file: rawData.case_file || null,
          event_count: typeof rawData.event_count === 'number' ? rawData.event_count : undefined,
          pending_actions: typeof rawData.pending_actions === 'number' ? rawData.pending_actions : undefined,
          created_at: rawData.created_at ? String(rawData.created_at) : null,
          updated_at: rawData.updated_at ? String(rawData.updated_at) : null,
        };
      }
      return null;
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch deal events - ALWAYS returns an array
 */
export async function getDealEvents(
  dealId: string,
  limit?: number
): Promise<DealEvent[]> {
  const query = limit ? `?limit=${limit}` : '';
  const data = await apiFetch<unknown>(`/api/deals/${dealId}/events${query}`);
  const parsed = EventsResponseSchema.safeParse(data);

  if (!parsed.success) {
    console.error('Invalid events response:', parsed.error);
    return [];
  }

  if (Array.isArray(parsed.data)) {
    return parsed.data;
  }
  return parsed.data.events;
}

/**
 * Fetch deal case file
 */
export async function getDealCaseFile(dealId: string): Promise<unknown | null> {
  try {
    return await apiFetch<unknown>(`/api/deals/${dealId}/case-file`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// ============================================================================
// Enrichment Types and Functions
// ============================================================================

export interface MaterialLink {
  url: string;
  normalized_url: string;
  link_type: string;
  label?: string;
  source_email_id?: string;
  source_timestamp?: string;
  requires_auth: boolean;
  vendor_hint?: string;
  status: string;
  context_text?: string;
  classification_confidence: number;
}

export interface DealEnrichment {
  deal_id: string;
  display_name?: string;
  target_company_name?: string;
  broker?: {
    name?: string;
    email?: string;
    company?: string;
    phone?: string;
    domain?: string;
  };
  last_email_at?: string;
  enrichment_confidence?: number;
  enriched_at?: string;
  materials: {
    total: number;
    by_type: Record<string, MaterialLink[]>;
    auth_required_count: number;
  };
  aliases: Array<{
    alias: string;
    alias_type: string;
    confidence: number;
  }>;
}

/**
 * Fetch deal enrichment data (materials, resolved names, etc.)
 */
export async function getDealEnrichment(dealId: string): Promise<DealEnrichment | null> {
  try {
    return await apiFetch<DealEnrichment>(`/api/deals/${dealId}/enrichment`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch all deferred actions - ALWAYS returns an array
 */
export async function getActions(params?: {
  deal_id?: string;
  status?: string;
}): Promise<Action[]> {
  const searchParams = new URLSearchParams();
  if (params?.deal_id) searchParams.set('deal_id', params.deal_id);
  if (params?.status) searchParams.set('status', params.status);

  const query = searchParams.toString();
  const endpoint = `/api/deferred-actions${query ? `?${query}` : ''}`;

  const data = await apiFetch<unknown>(endpoint);
  const parsed = ActionsResponseSchema.safeParse(data);

  if (!parsed.success) {
    console.error('Invalid actions response:', parsed.error);
    return [];
  }

  if (Array.isArray(parsed.data)) {
    return parsed.data;
  }
  return parsed.data.actions;
}

/**
 * Fetch due actions - ALWAYS returns an array
 */
export async function getDueActions(): Promise<Action[]> {
  const data = await apiFetch<unknown>('/api/deferred-actions/due');
  const parsed = ActionsResponseSchema.safeParse(data);

  if (!parsed.success) {
    console.error('Invalid due actions response:', parsed.error);
    return [];
  }

  if (Array.isArray(parsed.data)) {
    return parsed.data;
  }
  return parsed.data.actions;
}

/**
 * Fetch quarantine items - ALWAYS returns an array
 */
export async function getQuarantineItems(): Promise<QuarantineItem[]> {
  const data = await apiFetch<unknown>('/api/quarantine');
  const parsed = QuarantineResponseSchema.safeParse(data);

  if (!parsed.success) {
    console.error('Invalid quarantine response:', parsed.error);
    return [];
  }

  if (Array.isArray(parsed.data)) {
    return parsed.data;
  }
  return parsed.data.items;
}

/**
 * Fetch quarantine health status
 */
export async function getQuarantineHealth(): Promise<QuarantineHealth | null> {
  try {
    const data = await apiFetch<unknown>('/api/quarantine/health');
    const parsed = QuarantineHealthSchema.safeParse(data);

    if (!parsed.success) {
      console.error('Invalid quarantine health response:', parsed.error);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error('Failed to fetch quarantine health:', error);
    return null;
  }
}

/**
 * Resolve quarantine item
 */
export async function resolveQuarantineItem(
  itemId: string,
  resolution: 'link_to_deal' | 'create_new_deal' | 'discard',
  dealId?: string
): Promise<{ success: boolean; deal_id?: string }> {
  return apiFetch('/api/quarantine/' + itemId + '/resolve', {
    method: 'POST',
    body: JSON.stringify({
      resolution,
      deal_id: dealId,
      resolved_by: 'operator',
    }),
  });
}

/**
 * Canonical quarantine queue (EMAIL_TRIAGE.REVIEW_EMAIL actions pending approval)
 */
export async function getQuarantineQueue(params?: {
  limit?: number;
  offset?: number;
}): Promise<QuarantineItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  if (params?.offset != null) searchParams.set('offset', String(params.offset));
  const query = searchParams.toString();
  const endpoint = `/api/actions/quarantine${query ? `?${query}` : ''}`;

  const data = await apiFetch<unknown>(endpoint);
  const parsed = QuarantineResponseSchema.safeParse(data);

  if (!parsed.success) {
    console.error('Invalid quarantine queue response:', parsed.error);
    return [];
  }

  if (Array.isArray(parsed.data)) {
    return parsed.data;
  }
  return parsed.data.items;
}

/**
 * Local-only quarantine preview payload (right-side panel)
 */
export async function getQuarantinePreview(actionId: string): Promise<QuarantinePreview | null> {
  try {
    const data = await apiFetch<unknown>(`/api/actions/quarantine/${actionId}/preview`);
    const parsed = QuarantinePreviewSchema.safeParse(data);
    if (!parsed.success) {
      console.error('Invalid quarantine preview response:', parsed.error);
      return null;
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Approve + execute a quarantine (review email) action.
 */
export async function approveQuarantineItem(
  actionId: string,
  approvedBy: string
): Promise<{ success: boolean; error?: string }> {
  const approved = await approveKineticAction(actionId, approvedBy);
  if (!approved.success) {
    return { success: false, error: approved.error || 'Failed to approve quarantine item' };
  }
  const ran = await runKineticAction(actionId);
  if (!ran.success && ran.reason !== 'already_processing' && ran.reason !== 'already_completed') {
    return { success: false, error: ran.error || 'Failed to run quarantine item' };
  }
  return { success: true };
}

/**
 * Reject a quarantine item using the atomic backend endpoint.
 * This creates the reject action, executes it, and cancels the original - all in one call.
 */
export async function rejectQuarantineItem(params: {
  originalActionId: string;
  messageId: string;
  threadId?: string;
  reason?: string;
  rejectedBy: string;
}): Promise<{ success: boolean; reject_action_id?: string; error?: string }> {
  try {
    const response = await apiFetch<{
      ok: boolean;
      reject_action_id?: string;
      reject_status?: string;
      original_action_id?: string;
      already_resolved?: boolean;
      detail?: string;
    }>(`/api/actions/quarantine/${params.originalActionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({
        operator: params.rejectedBy,
        reason: params.reason,
      }),
    });

    if (response.ok) {
      return { success: true, reject_action_id: response.reject_action_id };
    }
    return { success: false, error: response.detail || 'Reject failed' };
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Reject failed' };
  }
}

/**
 * Delete (hide) a quarantine item from the decision queue.
 * This does NOT approve/reject, does NOT cancel the action, and does NOT touch Gmail.
 */
export async function deleteQuarantineItem(
  quarantineId: string,
  params?: { deletedBy?: string; reason?: string }
): Promise<{ hidden: boolean; quarantine_id: string }> {
  return apiFetch(`/api/quarantine/${encodeURIComponent(quarantineId)}/delete`, {
    method: 'POST',
    body: JSON.stringify({
      deleted_by: params?.deletedBy || 'operator',
      reason: params?.reason,
    }),
  });
}

/**
 * Bulk delete (hide) quarantine items from the decision queue.
 */
export async function bulkDeleteQuarantineItems(
  actionIds: string[],
  params?: { deletedBy?: string; reason?: string }
): Promise<{ hidden: string[]; missing: string[]; already_hidden: string[] }> {
  return apiFetch(`/api/quarantine/bulk-delete`, {
    method: 'POST',
    body: JSON.stringify({
      action_ids: actionIds,
      deleted_by: params?.deletedBy || 'operator',
      reason: params?.reason,
    }),
  });
}

/**
 * Filesystem-backed deal materials view (correspondence bundles + links)
 */
export async function getDealMaterials(dealId: string): Promise<DealMaterials | null> {
  try {
    const data = await apiFetch<unknown>(`/api/deals/${dealId}/materials`);
    const parsed = DealMaterialsSchema.safeParse(data);
    if (!parsed.success) {
      console.error('Invalid deal materials response:', parsed.error);
      return null;
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Fetch alerts - ALWAYS returns an array
 */
export async function getAlerts(): Promise<Alert[]> {
  const data = await apiFetch<unknown>('/api/alerts');
  const parsed = AlertsResponseSchema.safeParse(data);

  if (!parsed.success) {
    console.error('Invalid alerts response:', parsed.error);
    return [];
  }

  if (Array.isArray(parsed.data)) {
    return parsed.data;
  }
  return parsed.data.alerts;
}

/**
 * Fetch classification metrics
 */
export async function getClassificationMetrics(): Promise<ClassificationMetrics | null> {
  try {
    const data = await apiFetch<unknown>('/api/metrics/classification');
    const parsed = ClassificationMetricsSchema.safeParse(data);

    if (!parsed.success) {
      console.error('Invalid classification metrics response:', parsed.error);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error('Failed to fetch classification metrics:', error);
    return null;
  }
}

/**
 * Fetch checkpoints - ALWAYS returns an array
 */
export async function getCheckpoints(): Promise<Checkpoint[]> {
  try {
    const data = await apiFetch<unknown>('/api/checkpoints');
    const parsed = CheckpointsResponseSchema.safeParse(data);

    if (!parsed.success) {
      console.error('Invalid checkpoints response:', parsed.error);
      return [];
    }

    return parsed.data;
  } catch (error) {
    console.error('Failed to fetch checkpoints:', error);
    return [];
  }
}

/**
 * Fetch pipeline summary
 */
export async function getPipeline(): Promise<{
  total_active: number;
  stages: Record<string, PipelineStage>;
} | null> {
  try {
    const data = await apiFetch<unknown>('/api/pipeline');
    const parsed = PipelineResponseSchema.safeParse(data);

    if (!parsed.success) {
      console.error('Invalid pipeline response:', parsed.error);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error('Failed to fetch pipeline:', error);
    return null;
  }
}

/**
 * Transition deal to new stage
 */
export async function transitionDeal(
  dealId: string,
  toStage: string,
  reason: string,
  approvedBy: string
): Promise<{ success: boolean; message?: string }> {
  const params = new URLSearchParams();
  if (approvedBy) params.set('transitioned_by', approvedBy);
  const qs = params.toString();

  return apiFetch(`/api/deals/${dealId}/transition${qs ? `?${qs}` : ''}`, {
    method: 'POST',
    body: JSON.stringify({
      new_stage: toStage,
      reason,
    }),
  });
}

/**
 * Add note to deal
 */
export async function addDealNote(
  dealId: string,
  content: string,
  category?: string
): Promise<{ success: boolean; event_id?: string }> {
  return apiFetch(`/api/deals/${dealId}/note`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      category: category || 'general',
    }),
  });
}

// ============================================================================
// Chat API
// ============================================================================

export interface ChatScope {
  type: 'global' | 'deal' | 'document';
  deal_id?: string;
  doc?: {
    url?: string;
    title?: string;
  };
}

export interface ChatCitation {
  id: string;
  source: string;
  url?: string;
  snippet: string;
  chunk?: number;
  similarity?: number;
  event_id?: string;
  event_type?: string;
  timestamp?: string;
}

export interface ChatProposal {
  proposal_id: string;
  type: ChatProposalType;
  deal_id?: string;
  params?: Record<string, unknown>;
  reason?: string;
  status: 'pending_approval' | 'executed' | 'rejected' | 'failed';
  result?: unknown;
  error?: string;
  rejected_by?: string;
  rejected_at?: string;
  reject_reason?: string;
}

export const CHAT_PROPOSAL_TYPES = [
  'add_note',
  'draft_email',
  'create_task',
  'stage_transition',
  'request_docs',
] as const;

export type ChatProposalType = (typeof CHAT_PROPOSAL_TYPES)[number];

export function normalizeChatProposalType(type: string | null | undefined): ChatProposalType | null {
  const raw = (type || '').trim().toLowerCase();
  if (!raw) return null;

  const normalized = raw.replace(/[\s-]+/g, '_');
  const aliasMap: Record<string, ChatProposalType> = {
    schedule_action: 'create_task',
    schedule_task: 'create_task',
    scheduleaction: 'create_task',
  };

  const aliased = aliasMap[normalized] || (normalized as ChatProposalType);
  return CHAT_PROPOSAL_TYPES.includes(aliased) ? aliased : null;
}

export interface ChatEvidenceSummary {
  sources_queried: string[];
  rag: {
    query: string;
    results_found: number;
    top_similarity: number;
  };
  events: {
    window: string;
    count: number;
    types: string[];
  };
  case_file: {
    loaded: boolean;
    sections_used: string[];
  };
  registry: {
    loaded: boolean;
    stage: string | null;
  };
  actions: {
    count: number;
  };
  total_evidence_size: number;
}

export interface ChatResponse {
  content: string;
  citations: ChatCitation[];
  proposals: ChatProposal[];
  evidence_summary: ChatEvidenceSummary | null;
  model_used: string;
  latency_ms: number;
  warnings: string[];
}

export interface ChatStreamEvent {
  type: 'token' | 'evidence' | 'done' | 'error' | 'progress';
  data: {
    token?: string;
    citations?: ChatCitation[];
    proposals?: ChatProposal[];
    model_used?: string;
    latency_ms?: number;
    session_id?: string;
    message?: string;
  } | ChatEvidenceSummary;
}

/**
 * Send a chat message (non-streaming)
 */
export async function sendChatMessage(
  query: string,
  scope: ChatScope,
  sessionId?: string,
  options?: Record<string, unknown>
): Promise<ChatResponse> {
  return apiFetch('/api/chat/complete', {
    method: 'POST',
    body: JSON.stringify({
      query,
      scope,
      session_id: sessionId,
      options,
    }),
  });
}

/**
 * Send a chat message with SSE streaming
 * Returns an async generator that yields events
 */
export async function* streamChatMessage(
  query: string,
  scope: ChatScope,
  sessionId?: string,
  options?: Record<string, unknown>
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      scope,
      session_id: sessionId,
      options,
    }),
  });

  if (!response.ok) {
    // Try to get response body for better error message
    let errorBody = '';
    try {
      errorBody = await response.text();
      if (errorBody.length > 200) {
        errorBody = errorBody.slice(0, 200) + '...';
      }
    } catch {
      errorBody = response.statusText;
    }
    throw new ApiError(
      `Chat request failed: ${errorBody}`,
      response.status,
      '/api/chat'
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      let currentEvent = '';
      let currentData = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6);
        } else if (line === '' && currentEvent && currentData) {
          // End of event, yield it
          try {
            const parsedData = JSON.parse(currentData);
            yield {
              type: currentEvent as ChatStreamEvent['type'],
              data: parsedData,
            };
          } catch {
            console.debug('[Chat] Failed to parse SSE data:', currentData);
          }
          currentEvent = '';
          currentData = '';
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Execute a chat proposal (requires approval)
 */
export async function executeChatProposal(
  proposalId: string,
  sessionId: string,
  approvedBy: string,
  action: 'approve' | 'reject' = 'approve',
  rejectReason?: string
): Promise<{
  success: boolean;
  result?: unknown;
  proposal?: ChatProposal;
  proposal_type?: string;
  error?: string;
  reason?: string;
  current_status?: string;
}> {
  return apiFetch('/api/chat/execute-proposal', {
    method: 'POST',
    body: JSON.stringify({
      proposal_id: proposalId,
      session_id: sessionId,
      approved_by: approvedBy,
      action,
      reject_reason: rejectReason,
    }),
  });
}

/**
 * Get chat session history (with full message data from SQLite backend)
 */
export async function getChatSession(sessionId: string): Promise<{
  session_id: string;
  scope: ChatScope;
  created_at: string;
  last_activity: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp: string;
    citations?: ChatCitation[];
    proposals?: ChatProposal[];
    timings?: Record<string, unknown>;
    warnings?: string[];
    provider_used?: string;
    cache_hit?: boolean;
  }>;
} | null> {
  try {
    return await apiFetch(`/api/chat/session/${sessionId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// ============================================================================
// Kinetic Actions API (Action Engine v1.2)
// ============================================================================

/**
 * Kinetic Action statuses (state machine)
 */
export const KINETIC_ACTION_STATUSES = [
  'PENDING_APPROVAL',
  'READY',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type KineticActionStatus = (typeof KINETIC_ACTION_STATUSES)[number];

/**
 * Schema property for dynamic form generation
 */
export interface SchemaProperty {
  type: string;
  description?: string;
  required?: boolean;
  enum?: string[];
  default?: unknown;
  format?: string;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

/**
 * Input schema for capabilities (JSON Schema-like)
 */
export interface InputSchema {
  type: string;
  properties: Record<string, SchemaProperty>;
  required?: string[];
}

/**
 * Output artifact definition
 */
export interface OutputArtifact {
  type: string;
  description: string;
  mime_type: string;
}

/**
 * Capability manifest from backend
 */
export interface Capability {
  capability_id: string;
  version: string;
  title: string;
  description: string;
  action_type: string;
  input_schema: InputSchema;
  output_artifacts: OutputArtifact[];
  risk_level: 'low' | 'medium' | 'high';
  requires_approval: boolean;
  cloud_required?: boolean;
  llm_allowed?: boolean;
  constraints?: string[];
  examples?: Array<{
    description: string;
    inputs: Record<string, unknown>;
  }>;
  tags: string[];
}

/**
 * Artifact attached to a completed action
 */
export interface KineticArtifact {
  artifact_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  download_url: string;
}

/**
 * Kinetic Action (from Action Engine v1.2)
 */
export interface KineticAction {
  action_id: string;
  deal_id: string;
  action_type: string;
  capability_id?: string;
  title: string;
  summary?: string;
  status: KineticActionStatus;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  artifacts: KineticArtifact[];
  error?: {
    message: string;
    code?: string;
    category?: string;
    retryable?: boolean;
    details?: string;
  };
  created_at: string;
  updated_at: string;
  approved_at?: string;
  approved_by?: string;
  started_at?: string;
  completed_at?: string;
  retry_count: number;
  max_retries: number;
  created_by?: string;
  progress?: number;
  progress_message?: string;
}

/**
 * Action metrics from /api/actions/metrics
 */
export interface ActionMetrics {
  queue_lengths: Record<KineticActionStatus, number>;
  avg_duration_by_type: Record<string, { avg_seconds: number; count: number }>;
  success_rate_24h: number;
  total_24h: number;
  completed_24h: number;
  failed_24h: number;
  error_breakdown: Array<{ error: string; count: number }>;
}

// Zod schemas for Kinetic Actions API
const KineticArtifactSchema = z.object({
  artifact_id: z.string(),
  filename: z.string(),
  mime_type: z.string(),
  size_bytes: z.number(),
  created_at: z.string(),
  download_url: z.string(),
});

// KineticActionSchema: Hardened to handle null values from backend
// Uses .nullish() (null | undefined) for optional fields to handle legacy data
const KineticActionSchema = z.object({
  action_id: z.string(),
  // deal_id: Backend should send "GLOBAL" for non-deal actions, but handle null gracefully
  deal_id: z.string().nullish().transform(v => v || 'GLOBAL'),
  action_type: z.string(),
  // capability_id: May be null for legacy actions
  capability_id: z.string().nullish().transform(v => v ?? undefined),
  title: z.string(),
  summary: z.string().nullish().transform(v => v ?? undefined),
  status: z.enum(KINETIC_ACTION_STATUSES),
  // inputs: Some legacy rows may store null; coerce to {} (Zod .default does not apply to null)
  inputs: z.record(z.unknown()).nullish().transform(v => v ?? {}),
  outputs: z.record(z.unknown()).nullish().transform(v => v ?? undefined),
  artifacts: z.array(KineticArtifactSchema).nullish().transform(v => v ?? []),
  // error: May be null when no error, or object when failed
  error: z.object({
    message: z.string(),
    code: z.string().nullish().transform(v => v ?? undefined),
    category: z.string().nullish().transform(v => v ?? undefined),
    retryable: z.boolean().nullish().transform(v => v ?? undefined),
    details: z.string().nullish().transform(v => v ?? undefined),
  }).nullish().transform(v => v ?? undefined),
  created_at: z.string(),
  updated_at: z.string(),
  approved_at: z.string().nullish().transform(v => v ?? undefined),
  approved_by: z.string().nullish().transform(v => v ?? undefined),
  started_at: z.string().nullish().transform(v => v ?? undefined),
  completed_at: z.string().nullish().transform(v => v ?? undefined),
  retry_count: z.number().nullish().transform(v => v ?? 0),
  max_retries: z.number().nullish().transform(v => v ?? 3),
  created_by: z.string().nullish().transform(v => v ?? undefined),
  progress: z.number().nullish().transform(v => v ?? undefined),
  progress_message: z.string().nullish().transform(v => v ?? undefined),
});

const KineticActionsResponseSchema = z.object({
  count: z.number().optional(),
  actions: z.array(KineticActionSchema),
}).or(z.array(KineticActionSchema));

const CapabilitySchema = z.object({
  capability_id: z.string(),
  version: z.string(),
  title: z.string(),
  description: z.string(),
  action_type: z.string(),
  input_schema: z.object({
    type: z.string(),
    properties: z.record(z.unknown()),
    required: z.array(z.string()).optional(),
  }),
  output_artifacts: z.array(z.object({
    type: z.string(),
    description: z.string(),
    mime_type: z.string(),
  })),
  risk_level: z.enum(['low', 'medium', 'high']),
  requires_approval: z.boolean(),
  cloud_required: z.boolean().optional(),
  llm_allowed: z.boolean().optional(),
  constraints: z.array(z.string()).optional(),
  examples: z.array(z.object({
    description: z.string(),
    inputs: z.record(z.unknown()),
  })).optional(),
  tags: z.array(z.string()),
});

const CapabilitiesResponseSchema = z.object({
  capabilities: z.array(CapabilitySchema),
  count: z.number(),
});

const ActionMetricsSchema = z.object({
  queue_lengths: z.record(z.number()),
  avg_duration_by_type: z.record(z.object({
    avg_seconds: z.number(),
    count: z.number(),
  })),
  success_rate_24h: z.number(),
  total_24h: z.number(),
  completed_24h: z.number(),
  failed_24h: z.number(),
  error_breakdown: z.array(z.object({
    error: z.string(),
    count: z.number(),
  })),
});

/**
 * Check if Kinetic Actions API is available (mock mode detection)
 */
let _kineticApiAvailable: boolean | null = null;

async function isKineticApiAvailable(): Promise<boolean> {
  if (_kineticApiAvailable !== null) return _kineticApiAvailable;

  try {
    const response = await fetch('/api/actions/capabilities');
    _kineticApiAvailable = response.ok;
  } catch {
    _kineticApiAvailable = false;
  }
  return _kineticApiAvailable;
}

/**
 * Fetch all Kinetic Actions - ALWAYS returns an array
 * Falls back to legacy deferred-actions endpoint if Kinetic API unavailable
 */
export async function getKineticActions(params?: {
  deal_id?: string;
  status?: KineticActionStatus;
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<KineticAction[]> {
  const searchParams = new URLSearchParams();
  if (params?.deal_id) searchParams.set('deal_id', params.deal_id);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));

  const query = searchParams.toString();

  // Try Kinetic API first
  if (await isKineticApiAvailable()) {
    const endpoint = `/api/actions${query ? `?${query}` : ''}`;
    const data = await apiFetch<unknown>(endpoint);
    const parsed = KineticActionsResponseSchema.safeParse(data);

    if (!parsed.success) {
      console.error('Invalid Kinetic actions response:', parsed.error);
      return [];
    }

    if (Array.isArray(parsed.data)) {
      return parsed.data;
    }
    return parsed.data.actions;
  }

  // Fallback: convert legacy actions to Kinetic format
  const legacyActions = await getActions({
    deal_id: params?.deal_id,
    status: params?.status === 'COMPLETED' ? 'completed' : params?.status === 'PENDING_APPROVAL' ? 'pending' : undefined,
  });

  return legacyActions.map(a => ({
    action_id: a.action_id,
    deal_id: a.deal_id,
    action_type: a.action_type,
    title: a.action_type,
    status: a.status === 'completed' ? 'COMPLETED' : 'PENDING_APPROVAL' as KineticActionStatus,
    inputs: a.data || {},
    artifacts: [],
    created_at: a.scheduled_for,
    updated_at: a.scheduled_for,
    retry_count: 0,
    max_retries: 3,
  }));
}

/**
 * Fetch single Kinetic Action
 */
export async function getKineticAction(actionId: string): Promise<KineticAction | null> {
  if (!await isKineticApiAvailable()) {
    return null;
  }

  try {
    const data = await apiFetch<unknown>(`/api/actions/${actionId}`);
    const parsed = KineticActionSchema.safeParse(data);

    if (!parsed.success) {
      console.error('Invalid Kinetic action response:', parsed.error);
      return null;
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Create a new Kinetic Action
 */
export async function createKineticAction(params: {
  deal_id?: string;
  action_type: string;
  capability_id?: string;
  title: string;
  summary?: string;
  inputs: Record<string, unknown>;
  created_by?: string;
  source?: 'chat' | 'ui' | 'system';
  risk_level?: 'low' | 'medium' | 'high';
  requires_human_review?: boolean;
  idempotency_key?: string;
}): Promise<{ success: boolean; action_id?: string; action?: KineticAction; error?: string }> {
  if (!await isKineticApiAvailable()) {
    return { success: false, error: 'Kinetic Actions API not available' };
  }

  return apiFetch('/api/actions', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Approve a Kinetic Action (PENDING_APPROVAL → READY)
 */
export async function approveKineticAction(
  actionId: string,
  approvedBy: string
): Promise<{ success: boolean; action?: KineticAction; error?: string }> {
  return apiFetch(`/api/actions/${actionId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approved_by: approvedBy }),
  });
}

/**
 * Run/Execute a Kinetic Action (READY → PROCESSING)
 */
export async function runKineticAction(
  actionId: string
): Promise<{ success: boolean; action?: KineticAction; error?: string; reason?: string }> {
  return apiFetch(`/api/actions/${actionId}/execute`, {
    method: 'POST',
  });
}

/**
 * Cancel a Kinetic Action
 */
export async function cancelKineticAction(
  actionId: string,
  reason?: string
): Promise<{ success: boolean; action?: KineticAction; error?: string }> {
  return apiFetch(`/api/actions/${actionId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * Retry a failed Kinetic Action
 */
export async function retryKineticAction(
  actionId: string
): Promise<{ success: boolean; action?: KineticAction; error?: string }> {
  return apiFetch(`/api/actions/${actionId}/retry`, {
    method: 'POST',
  });
}

/**
 * Update Kinetic Action inputs (only when PENDING_APPROVAL)
 */
export async function updateKineticActionInputs(
  actionId: string,
  inputs: Record<string, unknown>
): Promise<{ success: boolean; action?: KineticAction; error?: string }> {
  return apiFetch(`/api/actions/${actionId}/update`, {
    method: 'POST',
    body: JSON.stringify({ inputs }),
  });
}

/**
 * Fetch action capabilities (for schema-driven forms)
 */
export async function getCapabilities(): Promise<Capability[]> {
  if (!await isKineticApiAvailable()) {
    // Return mock capabilities for development
    return getMockCapabilities();
  }

  try {
    const data = await apiFetch<unknown>('/api/actions/capabilities');
    const parsed = CapabilitiesResponseSchema.safeParse(data);

    if (!parsed.success) {
      console.error('Invalid capabilities response:', parsed.error);
      return getMockCapabilities();
    }

    return parsed.data.capabilities as Capability[];
  } catch (error) {
    console.error('Failed to fetch capabilities:', error);
    return getMockCapabilities();
  }
}

/**
 * Fetch action metrics
 */
export async function getActionMetrics(): Promise<ActionMetrics | null> {
  if (!await isKineticApiAvailable()) {
    return null;
  }

  try {
    const data = await apiFetch<unknown>('/api/actions/metrics');
    const parsed = ActionMetricsSchema.safeParse(data);

    if (!parsed.success) {
      console.error('Invalid metrics response:', parsed.error);
      return null;
    }

    return parsed.data as ActionMetrics;
  } catch (error) {
    console.error('Failed to fetch action metrics:', error);
    return null;
  }
}

/**
 * Download action artifact
 */
export function getArtifactDownloadUrl(actionId: string, artifactId: string): string {
  return `/api/actions/${actionId}/artifact/${artifactId}`;
}

// ============================================================================
// Action Archive/Delete APIs
// ============================================================================

/**
 * Archive a single action (soft delete)
 */
export async function archiveKineticAction(
  actionId: string
): Promise<{ success: boolean; action_id?: string; error?: string }> {
  return apiFetch(`/api/actions/${actionId}/archive`, {
    method: 'POST',
  });
}

/**
 * Delete a single action (hard delete)
 */
export async function deleteKineticAction(
  actionId: string
): Promise<{ success: boolean; action_id?: string; error?: string }> {
  return apiFetch(`/api/actions/${actionId}`, {
    method: 'DELETE',
  });
}

/**
 * Bulk archive multiple actions
 */
export async function bulkArchiveKineticActions(
  actionIds: string[]
): Promise<{ success: boolean; archived_count?: number; error?: string }> {
  return apiFetch('/api/actions/bulk/archive', {
    method: 'POST',
    body: JSON.stringify({ action_ids: actionIds }),
  });
}

/**
 * Bulk delete multiple actions
 */
export async function bulkDeleteKineticActions(
  actionIds: string[]
): Promise<{ success: boolean; deleted_count?: number; error?: string }> {
  return apiFetch('/api/actions/bulk/delete', {
    method: 'POST',
    body: JSON.stringify({ action_ids: actionIds }),
  });
}

/**
 * Clear completed actions by age
 */
export async function clearCompletedActions(
  operation: 'archive' | 'delete',
  age: 'all' | '7d' | '30d'
): Promise<{ success: boolean; affected_count?: number; error?: string }> {
  return apiFetch('/api/actions/clear-completed', {
    method: 'POST',
    body: JSON.stringify({ operation, age }),
  });
}

/**
 * Get count of completed actions (for confirmation dialog)
 */
export async function getCompletedActionsCount(
  age: 'all' | '7d' | '30d'
): Promise<{ count: number }> {
  return apiFetch(`/api/actions/completed-count?age=${age}`);
}

// ============================================================================
// Agent Activity API
// ============================================================================

// Zod schemas for Agent Activity
const AgentActivityEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  timestamp: z.string(),
  dealId: z.string().optional(),
  dealName: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const AgentActivityStatsSchema = z.object({
  toolsCalledToday: z.number(),
  approvalsProcessed: z.number(),
  dealsAnalyzed: z.number(),
  runsCompleted24h: z.number(),
});

const AgentLastActivitySchema = z.object({
  label: z.string(),
  timestamp: z.string(),
  dealId: z.string().optional(),
  threadId: z.string().optional(),
  runId: z.string().optional(),
});

const AgentCurrentRunSchema = z.object({
  runId: z.string(),
  threadId: z.string(),
  status: z.enum(['running', 'waiting_approval']),
  progressLabel: z.string(),
  startedAt: z.string(),
  dealId: z.string().optional(),
  dealName: z.string().optional(),
});

const AgentRecentRunSchema = z.object({
  runId: z.string(),
  threadId: z.string(),
  status: z.enum(['completed', 'failed', 'cancelled']),
  summary: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  dealId: z.string().optional(),
  dealName: z.string().optional(),
  toolsCalled: z.number(),
  approvalsRequested: z.number(),
});

const AgentActivityResponseSchema = z.object({
  status: z.enum(['idle', 'working', 'waiting_approval']),
  lastActivity: AgentLastActivitySchema.nullable(),
  recent: z.array(AgentActivityEventSchema),
  stats: AgentActivityStatsSchema,
  currentRun: AgentCurrentRunSchema.optional(),
  recentRuns: z.array(AgentRecentRunSchema),
});

export type AgentActivityResponse = z.infer<typeof AgentActivityResponseSchema>;

/**
 * Fetch agent activity data
 * Returns null on failure (graceful degradation)
 */
export async function getAgentActivity(limit?: number): Promise<AgentActivityResponse | null> {
  try {
    const query = limit ? `?limit=${limit}` : '';
    const data = await apiFetch<unknown>(`/api/agent/activity${query}`);
    const parsed = AgentActivityResponseSchema.safeParse(data);

    if (!parsed.success) {
      console.error('Invalid agent activity response:', parsed.error);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error('Failed to fetch agent activity:', error);
    return null;
  }
}

/**
 * Mock capabilities for development when backend not available
 */
function getMockCapabilities(): Capability[] {
  return [
    {
      capability_id: 'COMMUNICATION.DRAFT_EMAIL.v1',
      version: '1.0',
      title: 'Draft Email',
      description: 'Generate professional email draft for acquisition workflow communications',
      action_type: 'COMMUNICATION.DRAFT_EMAIL',
      input_schema: {
        type: 'object',
        properties: {
          recipient: { type: 'string', description: 'Recipient email address', required: true },
          subject: { type: 'string', description: 'Email subject line', required: true },
          context: { type: 'string', description: 'Context and purpose of email', required: true },
          tone: { type: 'string', description: 'Email tone', enum: ['professional', 'friendly', 'formal'], default: 'professional' },
        },
      },
      output_artifacts: [{ type: 'docx', description: 'Email draft', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }],
      risk_level: 'medium',
      requires_approval: true,
      constraints: ['Never send email automatically', 'Draft only; manual review required'],
      tags: ['communication', 'email', 'draft'],
    },
    {
      capability_id: 'DOCUMENT.GENERATE.v1',
      version: '1.0',
      title: 'Generate Document',
      description: 'Generate professional documents like summaries, teasers, or reports',
      action_type: 'DOCUMENT.GENERATE',
      input_schema: {
        type: 'object',
        properties: {
          document_type: { type: 'string', description: 'Type of document', enum: ['summary', 'teaser', 'report', 'memo'], required: true },
          title: { type: 'string', description: 'Document title', required: true },
          context: { type: 'string', description: 'Content context and requirements', required: true },
          format: { type: 'string', description: 'Output format', enum: ['docx', 'pdf'], default: 'docx' },
        },
      },
      output_artifacts: [{ type: 'docx', description: 'Generated document', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }],
      risk_level: 'low',
      requires_approval: true,
      tags: ['document', 'generate', 'report'],
    },
    {
      capability_id: 'ANALYSIS.BUILD_MODEL.v1',
      version: '1.0',
      title: 'Build Valuation Model',
      description: 'Build financial valuation model with KPIs and projections',
      action_type: 'ANALYSIS.BUILD_MODEL',
      input_schema: {
        type: 'object',
        properties: {
          model_type: { type: 'string', description: 'Type of model', enum: ['dcf', 'comps', 'lbo', 'custom'], required: true },
          assumptions: { type: 'string', description: 'Key assumptions and parameters' },
          include_sensitivity: { type: 'boolean', description: 'Include sensitivity analysis', default: true },
        },
      },
      output_artifacts: [{ type: 'xlsx', description: 'Financial model', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }],
      risk_level: 'medium',
      requires_approval: true,
      tags: ['analysis', 'valuation', 'financial'],
    },
  ];
}
