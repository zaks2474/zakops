/**
 * ZakOps Agent Tool Registry
 * ===========================
 *
 * Authoritative source of truth for all agent tools.
 * This registry defines every tool the agent can use, including:
 * - Risk levels and approval requirements
 * - Parameter schemas and validation
 * - Scope and external impact flags
 */

// =============================================================================
// TYPES
// =============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ToolCategory = 'read' | 'analyze' | 'create' | 'modify' | 'communicate' | 'critical';
export type ToolScope = 'global' | 'operator' | 'deal';
export type ParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface ToolParameter {
  name: string;
  type: ParameterType;
  required: boolean;
  description: string;
  validation?: string; // Regex or validation rule
  default?: unknown;
}

export interface ToolExample {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  description: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  scope: ToolScope;
  externalImpact: boolean;
  reversible: boolean;
  parameters: ToolParameter[];
  outputSchema: Record<string, unknown>;
  examples: ToolExample[];
}

// =============================================================================
// COMPLETE TOOL REGISTRY
// =============================================================================

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  // ---------------------------------------------------------------------------
  // LOW RISK - Read & Analyze (Auto-execute OK)
  // ---------------------------------------------------------------------------

  get_deal_context: {
    name: 'get_deal_context',
    description:
      'Retrieve complete context for a deal including stage, artifacts, actions, and history',
    category: 'read',
    riskLevel: 'low',
    requiresApproval: false,
    scope: 'deal',
    externalImpact: false,
    reversible: true,
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'UUID of the deal',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        deal: { type: 'object' },
        artifacts: { type: 'array' },
        actions: { type: 'array' },
        timeline: { type: 'array' },
      },
    },
    examples: [
      {
        input: { deal_id: 'abc-123' },
        output: {
          deal: { name: 'TechWidget Inc', stage: 'screening' },
          artifacts: [],
        },
        description: 'Get context for a deal in screening',
      },
    ],
  },

  get_operator_context: {
    name: 'get_operator_context',
    description:
      'Retrieve operator profile, buy box criteria, portfolio, and goals',
    category: 'read',
    riskLevel: 'low',
    requiresApproval: false,
    scope: 'operator',
    externalImpact: false,
    reversible: true,
    parameters: [
      {
        name: 'operator_id',
        type: 'string',
        required: true,
        description: 'UUID of the operator',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        profile: { type: 'object' },
        buyBox: { type: 'object' },
        portfolio: { type: 'array' },
        goals: { type: 'object' },
      },
    },
    examples: [],
  },

  search_documents: {
    name: 'search_documents',
    description:
      'Search indexed documents using semantic/keyword search (RAG)',
    category: 'read',
    riskLevel: 'low',
    requiresApproval: false,
    scope: 'deal',
    externalImpact: false,
    reversible: true,
    parameters: [
      {
        name: 'query',
        type: 'string',
        required: true,
        description: 'Search query',
      },
      {
        name: 'deal_id',
        type: 'string',
        required: false,
        description: 'Limit to specific deal',
      },
      {
        name: 'doc_types',
        type: 'array',
        required: false,
        description: 'Filter by document types',
      },
      {
        name: 'top_k',
        type: 'number',
        required: false,
        description: 'Number of results (default 5)',
        default: 5,
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              source: { type: 'string' },
              score: { type: 'number' },
              metadata: { type: 'object' },
            },
          },
        },
      },
    },
    examples: [],
  },

  extract_email_artifacts: {
    name: 'extract_email_artifacts',
    description: 'Parse and extract structured data from email content',
    category: 'analyze',
    riskLevel: 'low',
    requiresApproval: false,
    scope: 'deal',
    externalImpact: false,
    reversible: true,
    parameters: [
      {
        name: 'email_id',
        type: 'string',
        required: true,
        description: 'ID of the email to process',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        businessName: { type: 'string' },
        askingPrice: { type: 'number' },
        revenue: { type: 'number' },
        sde: { type: 'number' },
        industry: { type: 'string' },
        location: { type: 'string' },
        brokerName: { type: 'string' },
        brokerEmail: { type: 'string' },
        attachments: { type: 'array' },
      },
    },
    examples: [],
  },

  analyze_financials: {
    name: 'analyze_financials',
    description: 'Analyze financial documents and extract key metrics',
    category: 'analyze',
    riskLevel: 'low',
    requiresApproval: false,
    scope: 'deal',
    externalImpact: false,
    reversible: true,
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Deal to analyze',
      },
      {
        name: 'doc_ids',
        type: 'array',
        required: false,
        description: 'Specific documents to analyze',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        revenue: { type: 'object' },
        sde: { type: 'object' },
        margins: { type: 'object' },
        trends: { type: 'array' },
        redFlags: { type: 'array' },
        confidence: { type: 'number' },
      },
    },
    examples: [],
  },

  calculate_valuation: {
    name: 'calculate_valuation',
    description: 'Calculate business valuation using multiple methods',
    category: 'analyze',
    riskLevel: 'low',
    requiresApproval: false,
    scope: 'deal',
    externalImpact: false,
    reversible: true,
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Deal to value',
      },
      {
        name: 'methods',
        type: 'array',
        required: false,
        description: 'Valuation methods to use',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        sdeMultiple: { type: 'object' },
        revenueMultiple: { type: 'object' },
        dcf: { type: 'object' },
        recommended: { type: 'object' },
        comparables: { type: 'array' },
      },
    },
    examples: [],
  },

  score_buy_box_fit: {
    name: 'score_buy_box_fit',
    description: 'Calculate how well a deal matches the operator buy box',
    category: 'analyze',
    riskLevel: 'low',
    requiresApproval: false,
    scope: 'deal',
    externalImpact: false,
    reversible: true,
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Deal to score',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        overallScore: { type: 'number' },
        breakdown: { type: 'array' },
        matchedCriteria: { type: 'array' },
        missedCriteria: { type: 'array' },
        dealBreakers: { type: 'array' },
      },
    },
    examples: [],
  },

  get_comparable_deals: {
    name: 'get_comparable_deals',
    description: 'Find similar deals for comparison (from market data)',
    category: 'read',
    riskLevel: 'low',
    requiresApproval: false,
    scope: 'global',
    externalImpact: false,
    reversible: true,
    parameters: [
      {
        name: 'industry',
        type: 'string',
        required: true,
        description: 'Industry to search',
      },
      {
        name: 'revenue_range',
        type: 'object',
        required: false,
        description: 'Revenue min/max',
      },
      {
        name: 'sde_range',
        type: 'object',
        required: false,
        description: 'SDE min/max',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        comparables: { type: 'array' },
        averageMultiple: { type: 'number' },
        medianMultiple: { type: 'number' },
      },
    },
    examples: [],
  },

  summarize_document: {
    name: 'summarize_document',
    description: 'Create a structured summary of a document',
    category: 'analyze',
    riskLevel: 'low',
    requiresApproval: false,
    scope: 'deal',
    externalImpact: false,
    reversible: true,
    parameters: [
      {
        name: 'doc_id',
        type: 'string',
        required: true,
        description: 'Document to summarize',
      },
      {
        name: 'summary_type',
        type: 'string',
        required: false,
        description: 'Type: brief, detailed, executive',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        keyPoints: { type: 'array' },
        sections: { type: 'array' },
      },
    },
    examples: [],
  },

  // ---------------------------------------------------------------------------
  // MEDIUM RISK - Create & Modify (Approval Required by Default)
  // ---------------------------------------------------------------------------

  create_deal: {
    name: 'create_deal',
    description: 'Create a new deal record in the system',
    category: 'create',
    riskLevel: 'medium',
    requiresApproval: true, // Creates permanent record
    scope: 'global',
    externalImpact: false,
    reversible: true, // Can archive
    parameters: [
      {
        name: 'name',
        type: 'string',
        required: true,
        description: 'Business name',
      },
      {
        name: 'source',
        type: 'string',
        required: true,
        description: 'Lead source',
      },
      {
        name: 'broker_email',
        type: 'string',
        required: false,
        description: 'Broker email',
      },
      {
        name: 'initial_data',
        type: 'object',
        required: false,
        description: 'Extracted deal data',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string' },
        created: { type: 'boolean' },
      },
    },
    examples: [],
  },

  update_deal: {
    name: 'update_deal',
    description: 'Update fields on an existing deal',
    category: 'modify',
    riskLevel: 'medium',
    requiresApproval: true,
    scope: 'deal',
    externalImpact: false,
    reversible: true,
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Deal to update',
      },
      {
        name: 'updates',
        type: 'object',
        required: true,
        description: 'Fields to update',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        updated: { type: 'boolean' },
        changes: { type: 'array' },
      },
    },
    examples: [],
  },

  advance_deal_stage: {
    name: 'advance_deal_stage',
    description: 'Move a deal to a different stage',
    category: 'modify',
    riskLevel: 'medium',
    requiresApproval: true, // Stage changes are significant
    scope: 'deal',
    externalImpact: false,
    reversible: true,
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Deal to advance',
      },
      {
        name: 'new_stage',
        type: 'string',
        required: true,
        description: 'Target stage',
      },
      {
        name: 'reason',
        type: 'string',
        required: true,
        description: 'Reason for transition',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        from_stage: { type: 'string' },
        to_stage: { type: 'string' },
      },
    },
    examples: [],
  },

  create_action: {
    name: 'create_action',
    description: 'Create a pending action item for the operator',
    category: 'create',
    riskLevel: 'medium',
    requiresApproval: true,
    scope: 'deal',
    externalImpact: false,
    reversible: true,
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Associated deal',
      },
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Action title',
      },
      {
        name: 'description',
        type: 'string',
        required: true,
        description: 'What needs to be done',
      },
      {
        name: 'due_date',
        type: 'string',
        required: false,
        description: 'Due date (ISO)',
      },
      {
        name: 'priority',
        type: 'string',
        required: false,
        description: 'low, medium, high',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        action_id: { type: 'string' },
        created: { type: 'boolean' },
      },
    },
    examples: [],
  },

  draft_broker_response: {
    name: 'draft_broker_response',
    description: 'Draft an email response to a broker (NOT SENT)',
    category: 'create',
    riskLevel: 'medium',
    requiresApproval: true, // Drafts should be reviewed
    scope: 'deal',
    externalImpact: false, // Draft only
    reversible: true,
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Associated deal',
      },
      {
        name: 'intent',
        type: 'string',
        required: true,
        description: 'Purpose of email',
      },
      {
        name: 'tone',
        type: 'string',
        required: false,
        description: 'formal, friendly, brief',
      },
      {
        name: 'include_questions',
        type: 'array',
        required: false,
        description: 'Questions to include',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        draft_id: { type: 'string' },
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
    },
    examples: [],
  },

  draft_loi: {
    name: 'draft_loi',
    description: 'Draft a Letter of Intent (NOT SUBMITTED)',
    category: 'create',
    riskLevel: 'medium',
    requiresApproval: true,
    scope: 'deal',
    externalImpact: false, // Draft only
    reversible: true,
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Associated deal',
      },
      {
        name: 'offer_price',
        type: 'number',
        required: true,
        description: 'Offer amount',
      },
      {
        name: 'terms',
        type: 'object',
        required: true,
        description: 'Deal terms',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        draft_id: { type: 'string' },
        document: { type: 'string' },
        terms_summary: { type: 'object' },
      },
    },
    examples: [],
  },

  add_deal_note: {
    name: 'add_deal_note',
    description: 'Add a note to the deal record',
    category: 'create',
    riskLevel: 'medium',
    requiresApproval: true,
    scope: 'deal',
    externalImpact: false,
    reversible: true,
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Associated deal',
      },
      {
        name: 'content',
        type: 'string',
        required: true,
        description: 'Note content',
      },
      {
        name: 'category',
        type: 'string',
        required: false,
        description: 'Note category',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        note_id: { type: 'string' },
        created: { type: 'boolean' },
      },
    },
    examples: [],
  },

  create_task: {
    name: 'create_task',
    description: 'Create a follow-up task',
    category: 'create',
    riskLevel: 'medium',
    requiresApproval: true,
    scope: 'deal',
    externalImpact: false,
    reversible: true,
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: false,
        description: 'Associated deal',
      },
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Task title',
      },
      {
        name: 'due_date',
        type: 'string',
        required: false,
        description: 'Due date',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        created: { type: 'boolean' },
      },
    },
    examples: [],
  },

  tag_deal: {
    name: 'tag_deal',
    description: 'Add tags/labels to a deal',
    category: 'modify',
    riskLevel: 'medium',
    requiresApproval: false, // Tags are low impact
    scope: 'deal',
    externalImpact: false,
    reversible: true,
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Deal to tag',
      },
      {
        name: 'tags',
        type: 'array',
        required: true,
        description: 'Tags to add',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        updated: { type: 'boolean' },
        tags: { type: 'array' },
      },
    },
    examples: [],
  },

  // ---------------------------------------------------------------------------
  // HIGH RISK - External Communication (Always Requires Approval)
  // ---------------------------------------------------------------------------

  send_email: {
    name: 'send_email',
    description: 'Send an email to an external party',
    category: 'communicate',
    riskLevel: 'high',
    requiresApproval: true, // ALWAYS
    scope: 'deal',
    externalImpact: true,
    reversible: false, // Can't unsend
    parameters: [
      {
        name: 'to',
        type: 'string',
        required: true,
        description: 'Recipient email',
      },
      {
        name: 'subject',
        type: 'string',
        required: true,
        description: 'Email subject',
      },
      {
        name: 'body',
        type: 'string',
        required: true,
        description: 'Email body',
      },
      {
        name: 'deal_id',
        type: 'string',
        required: false,
        description: 'Associated deal',
      },
      {
        name: 'attachments',
        type: 'array',
        required: false,
        description: 'Attachment IDs',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        sent: { type: 'boolean' },
        message_id: { type: 'string' },
      },
    },
    examples: [],
  },

  schedule_meeting: {
    name: 'schedule_meeting',
    description: 'Create a calendar event with external party',
    category: 'communicate',
    riskLevel: 'high',
    requiresApproval: true,
    scope: 'deal',
    externalImpact: true,
    reversible: true, // Can cancel
    parameters: [
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Meeting title',
      },
      {
        name: 'attendees',
        type: 'array',
        required: true,
        description: 'Attendee emails',
      },
      {
        name: 'datetime',
        type: 'string',
        required: true,
        description: 'Meeting time (ISO)',
      },
      {
        name: 'duration',
        type: 'number',
        required: true,
        description: 'Duration in minutes',
      },
      {
        name: 'deal_id',
        type: 'string',
        required: false,
        description: 'Associated deal',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        scheduled: { type: 'boolean' },
        event_id: { type: 'string' },
      },
    },
    examples: [],
  },

  request_documents: {
    name: 'request_documents',
    description: 'Send document request to broker/seller',
    category: 'communicate',
    riskLevel: 'high',
    requiresApproval: true,
    scope: 'deal',
    externalImpact: true,
    reversible: false,
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Associated deal',
      },
      {
        name: 'documents',
        type: 'array',
        required: true,
        description: 'Documents to request',
      },
      {
        name: 'message',
        type: 'string',
        required: false,
        description: 'Custom message',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        sent: { type: 'boolean' },
        request_id: { type: 'string' },
      },
    },
    examples: [],
  },

  share_deal: {
    name: 'share_deal',
    description: 'Share deal information with advisor/partner',
    category: 'communicate',
    riskLevel: 'high',
    requiresApproval: true,
    scope: 'deal',
    externalImpact: true,
    reversible: true, // Can revoke access
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Deal to share',
      },
      {
        name: 'recipient_email',
        type: 'string',
        required: true,
        description: 'Who to share with',
      },
      {
        name: 'permission',
        type: 'string',
        required: true,
        description: 'view or edit',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        shared: { type: 'boolean' },
        share_id: { type: 'string' },
      },
    },
    examples: [],
  },

  // ---------------------------------------------------------------------------
  // CRITICAL - Major Consequences (Approval + Confirmation Required)
  // ---------------------------------------------------------------------------

  submit_loi: {
    name: 'submit_loi',
    description: 'Submit Letter of Intent to seller/broker',
    category: 'critical',
    riskLevel: 'critical',
    requiresApproval: true, // ALWAYS + confirmation
    scope: 'deal',
    externalImpact: true,
    reversible: false, // Major commitment
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Associated deal',
      },
      {
        name: 'loi_draft_id',
        type: 'string',
        required: true,
        description: 'Draft to submit',
      },
      {
        name: 'delivery_method',
        type: 'string',
        required: true,
        description: 'email, portal, etc.',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        submitted: { type: 'boolean' },
        submission_id: { type: 'string' },
        timestamp: { type: 'string' },
      },
    },
    examples: [],
  },

  sign_document: {
    name: 'sign_document',
    description: 'Execute document signing (e-signature)',
    category: 'critical',
    riskLevel: 'critical',
    requiresApproval: true,
    scope: 'deal',
    externalImpact: true,
    reversible: false,
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Associated deal',
      },
      {
        name: 'document_id',
        type: 'string',
        required: true,
        description: 'Document to sign',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        signed: { type: 'boolean' },
        signature_id: { type: 'string' },
      },
    },
    examples: [],
  },

  reject_deal: {
    name: 'reject_deal',
    description: 'Formally reject/pass on a deal',
    category: 'critical',
    riskLevel: 'critical',
    requiresApproval: true,
    scope: 'deal',
    externalImpact: true, // May notify broker
    reversible: true, // Can reactivate
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Deal to reject',
      },
      {
        name: 'reason',
        type: 'string',
        required: true,
        description: 'Reason for rejection',
      },
      {
        name: 'notify_broker',
        type: 'boolean',
        required: false,
        description: 'Send rejection notice',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        rejected: { type: 'boolean' },
        notification_sent: { type: 'boolean' },
      },
    },
    examples: [],
  },

  archive_deal: {
    name: 'archive_deal',
    description: 'Archive a deal permanently',
    category: 'critical',
    riskLevel: 'critical',
    requiresApproval: true,
    scope: 'deal',
    externalImpact: false,
    reversible: false, // Archive is permanent
    parameters: [
      {
        name: 'deal_id',
        type: 'string',
        required: true,
        description: 'Deal to archive',
      },
      {
        name: 'reason',
        type: 'string',
        required: true,
        description: 'Archive reason',
      },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        archived: { type: 'boolean' },
      },
    },
    examples: [],
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get tool definition by name.
 */
export function getToolDefinition(
  toolName: string
): ToolDefinition | undefined {
  return TOOL_REGISTRY[toolName];
}

/**
 * Get all tools at a given risk level.
 */
export function getToolsByRiskLevel(riskLevel: RiskLevel): ToolDefinition[] {
  return Object.values(TOOL_REGISTRY).filter((t) => t.riskLevel === riskLevel);
}

/**
 * Get all tools in a given category.
 */
export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return Object.values(TOOL_REGISTRY).filter((t) => t.category === category);
}

/**
 * Check if a tool requires approval.
 */
export function toolRequiresApproval(toolName: string): boolean {
  const tool = TOOL_REGISTRY[toolName];
  return tool?.requiresApproval ?? true; // Default to requiring approval
}

/**
 * Check if a tool has external impact.
 */
export function toolHasExternalImpact(toolName: string): boolean {
  const tool = TOOL_REGISTRY[toolName];
  return tool?.externalImpact ?? false;
}

/**
 * Get all tool names.
 */
export function getAllToolNames(): string[] {
  return Object.keys(TOOL_REGISTRY);
}

/**
 * Get tools that can be auto-executed (low risk, no approval required).
 */
export function getAutoExecutableTools(): ToolDefinition[] {
  return Object.values(TOOL_REGISTRY).filter(
    (t) => t.riskLevel === 'low' && !t.requiresApproval && !t.externalImpact
  );
}

/**
 * Convert tool registry to LangSmith-compatible format.
 */
export function getToolManifestForLangSmith(): Array<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return Object.values(TOOL_REGISTRY).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(
        tool.parameters.map((p) => [
          p.name,
          {
            type: p.type,
            description: p.description,
            ...(p.default !== undefined && { default: p.default }),
          },
        ])
      ),
      required: tool.parameters.filter((p) => p.required).map((p) => p.name),
    },
  }));
}
