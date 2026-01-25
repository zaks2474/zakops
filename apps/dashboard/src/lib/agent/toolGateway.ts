/**
 * ZakOps Tool Gateway
 * ====================
 *
 * Enforces the agent contract regardless of agent behavior.
 * This is the enforcement layer that:
 * - Validates tool calls against the registry
 * - Enforces risk-based approval requirements
 * - Applies rate limits
 * - Logs all tool invocations
 */

import {
  TOOL_REGISTRY,
  ToolDefinition,
  RiskLevel,
} from './toolRegistry';
import {
  SafetyConfig,
  DEFAULT_SAFETY_CONFIG,
  shouldAutoExecute,
  isToolDisabled,
} from '@/config/safety';

// =============================================================================
// TYPES
// =============================================================================

export interface ToolCall {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status:
    | 'pending'
    | 'requires_approval'
    | 'approved'
    | 'rejected'
    | 'executing'
    | 'completed'
    | 'failed';
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  startedAt: Date;
  completedAt?: Date;
  result?: unknown;
  error?: string;
}

export interface AgentRun {
  id: string;
  threadId: string;
  assistantId: string;
  status:
    | 'pending'
    | 'running'
    | 'waiting_approval'
    | 'completed'
    | 'failed'
    | 'cancelled';
  input: string;
  toolCalls: ToolCall[];
  outputs: unknown[];
  startedAt: Date;
  completedAt?: Date;
  idempotencyKey: string;
  operatorId: string;
  dealId?: string;
}

export interface ThreadContext {
  operatorId: string;
  dealId?: string;
}

export interface ApprovalRequest {
  id: string;
  runId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  riskLevel: RiskLevel;
  preview: string;
  evidence: string[];
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  decidedBy?: string;
  decidedAt?: Date;
  rejectionReason?: string;
}

export interface ToolExecutionResult {
  status: 'executed' | 'waiting_approval' | 'rejected' | 'error';
  result?: unknown;
  error?: string;
  approvalId?: string;
}

export interface AgentEvent {
  type: string;
  runId?: string;
  threadId?: string;
  timestamp: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// Database interface (to be implemented by actual database layer)
export interface GatewayDatabase {
  approvals: {
    create: (approval: ApprovalRequest) => Promise<void>;
    findById: (id: string) => Promise<ApprovalRequest | null>;
    update: (id: string, data: Partial<ApprovalRequest>) => Promise<void>;
  };
  toolCalls: {
    countByRun: (runId: string) => Promise<number>;
    update: (id: string, data: Partial<ToolCall>) => Promise<void>;
  };
  runs: {
    findById: (id: string) => Promise<AgentRun | null>;
    update: (id: string, data: Partial<AgentRun>) => Promise<void>;
    countRecentByOperator: (operatorId: string, windowMs: number) => Promise<number>;
  };
  threads: {
    findById: (id: string) => Promise<{ operatorId: string; dealId?: string } | null>;
  };
  executionLogs: {
    create: (log: Record<string, unknown>) => Promise<void>;
  };
  events: {
    create: (event: Record<string, unknown>) => Promise<void>;
  };
}

// Event emitter interface
export interface GatewayEventEmitter {
  emit: (event: string, data: AgentEvent) => void;
}

export interface GatewayConfig {
  safetyConfig: SafetyConfig;
  database: GatewayDatabase;
  eventEmitter: GatewayEventEmitter;
}

// =============================================================================
// TOOL GATEWAY CLASS
// =============================================================================

export class ToolGateway {
  private config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  // ---------------------------------------------------------------------------
  // MAIN EXECUTION ENTRY POINT
  // ---------------------------------------------------------------------------

  /**
   * Execute a tool call with full safety checks.
   * This is the ONLY way tools should be executed.
   */
  async executeToolCall(
    toolCall: ToolCall,
    run: AgentRun,
    context: ThreadContext
  ): Promise<ToolExecutionResult> {
    // 1. Validate tool exists
    const toolDef = TOOL_REGISTRY[toolCall.toolName];
    if (!toolDef) {
      return {
        status: 'error',
        error: `Unknown tool: ${toolCall.toolName}. Tool not in registry.`,
      };
    }

    // 2. Check if tool is disabled
    if (isToolDisabled(this.config.safetyConfig, toolCall.toolName)) {
      return {
        status: 'error',
        error: `Tool is disabled: ${toolCall.toolName}`,
      };
    }

    // 3. Validate parameters
    const paramValidation = this.validateParameters(toolCall, toolDef);
    if (!paramValidation.valid) {
      return {
        status: 'error',
        error: `Invalid parameters: ${paramValidation.errors.join(', ')}`,
      };
    }

    // 4. Check rate limits
    const rateLimitCheck = await this.checkRateLimits(run, toolCall);
    if (!rateLimitCheck.allowed) {
      return {
        status: 'error',
        error: `Rate limit exceeded: ${rateLimitCheck.reason}`,
      };
    }

    // 5. Determine if auto-execute is allowed
    const canAutoExecute = this.canAutoExecute(toolCall.toolName, toolDef);

    // 6. If approval required, pause and create approval request
    if (!canAutoExecute) {
      const approval = await this.createApprovalRequest(toolCall, run, toolDef);

      // Emit event for UI
      await this.emitEvent({
        type: 'action.approval_requested',
        runId: run.id,
        threadId: run.threadId,
        timestamp: new Date().toISOString(),
        payload: {
          approvalId: approval.id,
          toolCallId: toolCall.id,
          toolName: toolCall.toolName,
          riskLevel: toolDef.riskLevel,
          preview: approval.preview,
          externalImpact: toolDef.externalImpact,
        },
        metadata: {
          dealId: context.dealId,
        },
      });

      return {
        status: 'waiting_approval',
        approvalId: approval.id,
      };
    }

    // 7. Execute the tool
    try {
      const result = await this.executeTool(toolCall, toolDef, context);

      // Log execution for audit
      await this.logExecution(toolCall, result, run, 'auto');

      // Emit completion event
      await this.emitEvent({
        type: 'agent.tool_completed',
        runId: run.id,
        threadId: run.threadId,
        timestamp: new Date().toISOString(),
        payload: {
          toolCallId: toolCall.id,
          toolName: toolCall.toolName,
          success: true,
        },
        metadata: {
          dealId: context.dealId,
        },
      });

      return {
        status: 'executed',
        result,
      };
    } catch (error) {
      await this.logError(toolCall, error, run);

      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // APPROVAL WORKFLOW
  // ---------------------------------------------------------------------------

  /**
   * Process approval for a pending tool call.
   */
  async processApproval(
    approvalId: string,
    decision: 'approve' | 'reject',
    operator: { id: string; name: string },
    modifications?: Record<string, unknown>,
    rejectionReason?: string
  ): Promise<ToolExecutionResult> {
    // Get approval request
    const approval = await this.config.database.approvals.findById(approvalId);
    if (!approval) {
      return { status: 'error', error: 'Approval request not found' };
    }

    if (approval.status !== 'pending') {
      return { status: 'error', error: `Approval already ${approval.status}` };
    }

    // Check expiration
    if (new Date() > approval.expiresAt) {
      await this.config.database.approvals.update(approvalId, {
        status: 'expired',
      });
      return { status: 'error', error: 'Approval request expired' };
    }

    if (decision === 'reject') {
      // Update approval record
      await this.config.database.approvals.update(approvalId, {
        status: 'rejected',
        decidedBy: operator.id,
        decidedAt: new Date(),
        rejectionReason,
      });

      // Update tool call record
      await this.config.database.toolCalls.update(approval.toolCallId, {
        status: 'rejected',
        rejectedBy: operator.id,
        rejectedAt: new Date(),
        rejectionReason,
      });

      // Emit event
      await this.emitEvent({
        type: 'action.rejected',
        runId: approval.runId,
        threadId: '', // Get from run
        timestamp: new Date().toISOString(),
        payload: {
          approvalId,
          toolCallId: approval.toolCallId,
          toolName: approval.toolName,
          rejectedBy: operator.name,
          reason: rejectionReason,
        },
      });

      return { status: 'rejected' };
    }

    // Process approval
    await this.config.database.approvals.update(approvalId, {
      status: 'approved',
      decidedBy: operator.id,
      decidedAt: new Date(),
    });

    // Get run context
    const run = await this.config.database.runs.findById(approval.runId);
    if (!run) {
      return { status: 'error', error: 'Run not found' };
    }

    // Apply modifications if any
    const finalArgs = modifications
      ? { ...approval.args, ...modifications }
      : approval.args;

    // Execute the tool
    const toolCall: ToolCall = {
      id: approval.toolCallId,
      toolName: approval.toolName,
      args: finalArgs,
      status: 'approved',
      riskLevel: approval.riskLevel,
      requiresApproval: true,
      approvedBy: operator.id,
      approvedAt: new Date(),
      startedAt: new Date(),
    };

    const toolDef = TOOL_REGISTRY[approval.toolName];
    const context = await this.getContextFromRun(run);

    try {
      const result = await this.executeTool(toolCall, toolDef, context);

      // Log execution
      await this.logExecution(toolCall, result, run, 'approved', operator.id);

      // Update tool call
      await this.config.database.toolCalls.update(approval.toolCallId, {
        status: 'completed',
        result,
        completedAt: new Date(),
      });

      // Emit completion event
      await this.emitEvent({
        type: 'action.completed',
        runId: run.id,
        threadId: run.threadId,
        timestamp: new Date().toISOString(),
        payload: {
          approvalId,
          toolCallId: approval.toolCallId,
          toolName: approval.toolName,
          approvedBy: operator.name,
        },
      });

      return { status: 'executed', result };
    } catch (error) {
      await this.logError(toolCall, error, run);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Execution failed',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // SAFETY CHECKS
  // ---------------------------------------------------------------------------

  /**
   * Determine if a tool can auto-execute based on safety config.
   */
  private canAutoExecute(toolName: string, toolDef: ToolDefinition): boolean {
    return shouldAutoExecute(
      this.config.safetyConfig,
      toolName,
      toolDef.riskLevel,
      toolDef.requiresApproval,
      toolDef.externalImpact
    );
  }

  /**
   * Check rate limits for tool execution.
   */
  private async checkRateLimits(
    run: AgentRun,
    _toolCall: ToolCall
  ): Promise<{ allowed: boolean; reason?: string }> {
    const config = this.config.safetyConfig;

    // Check tool calls per run
    const toolCallCount = await this.config.database.toolCalls.countByRun(
      run.id
    );
    if (toolCallCount >= config.MAX_TOOL_CALLS_PER_RUN) {
      return {
        allowed: false,
        reason: `Maximum tool calls per run (${config.MAX_TOOL_CALLS_PER_RUN}) exceeded`,
      };
    }

    // Check runs per minute for operator
    const recentRuns =
      await this.config.database.runs.countRecentByOperator(
        run.operatorId,
        60000 // Last minute
      );
    if (recentRuns >= config.MAX_RUNS_PER_MINUTE) {
      return {
        allowed: false,
        reason: `Maximum runs per minute (${config.MAX_RUNS_PER_MINUTE}) exceeded`,
      };
    }

    return { allowed: true };
  }

  /**
   * Validate tool parameters against schema.
   */
  private validateParameters(
    toolCall: ToolCall,
    toolDef: ToolDefinition
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const param of toolDef.parameters) {
      const value = toolCall.args[param.name];

      // Check required
      if (param.required && (value === undefined || value === null)) {
        errors.push(`Missing required parameter: ${param.name}`);
        continue;
      }

      // Check type
      if (value !== undefined && value !== null) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (
          actualType !== param.type &&
          !(param.type === 'object' && actualType === 'object')
        ) {
          errors.push(
            `Parameter ${param.name}: expected ${param.type}, got ${actualType}`
          );
        }
      }

      // Check validation regex
      if (param.validation && value) {
        const regex = new RegExp(param.validation);
        if (!regex.test(String(value))) {
          errors.push(`Parameter ${param.name}: failed validation`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ---------------------------------------------------------------------------
  // APPROVAL REQUEST CREATION
  // ---------------------------------------------------------------------------

  private async createApprovalRequest(
    toolCall: ToolCall,
    run: AgentRun,
    toolDef: ToolDefinition
  ): Promise<ApprovalRequest> {
    const approval: ApprovalRequest = {
      id: crypto.randomUUID(),
      runId: run.id,
      toolCallId: toolCall.id,
      toolName: toolCall.toolName,
      args: toolCall.args,
      riskLevel: toolDef.riskLevel,
      preview: this.generatePreview(toolCall, toolDef),
      evidence: [], // TODO: Extract from run context
      createdAt: new Date(),
      expiresAt: new Date(
        Date.now() + this.config.safetyConfig.APPROVAL_EXPIRATION_MS
      ),
      status: 'pending',
    };

    await this.config.database.approvals.create(approval);

    // Update tool call status
    await this.config.database.toolCalls.update(toolCall.id, {
      status: 'requires_approval',
    });

    // Update run status
    await this.config.database.runs.update(run.id, {
      status: 'waiting_approval',
    });

    return approval;
  }

  /**
   * Generate human-readable preview of what the tool will do.
   */
  private generatePreview(
    toolCall: ToolCall,
    toolDef: ToolDefinition
  ): string {
    const args = toolCall.args;

    switch (toolCall.toolName) {
      case 'send_email':
        return `Send email to ${args.to}\nSubject: ${args.subject}\n\n${this.truncate(String(args.body || ''), 200)}`;

      case 'submit_loi':
        return `Submit Letter of Intent for deal\nOffer: ${(args.offer_price as number)?.toLocaleString()}\nDelivery: ${args.delivery_method}`;

      case 'advance_deal_stage':
        return `Move deal to ${args.new_stage} stage\nReason: ${args.reason}`;

      case 'create_deal':
        return `Create new deal: ${args.name}\nSource: ${args.source}`;

      case 'draft_broker_response':
        return `Draft email to broker\nIntent: ${args.intent}`;

      case 'draft_loi':
        return `Draft LOI with offer of ${(args.offer_price as number)?.toLocaleString()}`;

      case 'schedule_meeting':
        return `Schedule meeting: ${args.title}\nWith: ${(args.attendees as string[])?.join(', ')}\nTime: ${args.datetime}`;

      case 'request_documents':
        return `Request documents:\n${(args.documents as string[])?.map((d) => `- ${d}`).join('\n')}`;

      case 'share_deal':
        return `Share deal with ${args.recipient_email} (${args.permission} access)`;

      case 'reject_deal':
        return `Reject deal\nReason: ${args.reason}\nNotify broker: ${args.notify_broker ? 'Yes' : 'No'}`;

      case 'archive_deal':
        return `Archive deal\nReason: ${args.reason}`;

      case 'update_deal':
        return `Update deal fields:\n${JSON.stringify(args.updates, null, 2)}`;

      case 'create_action':
        return `Create action: ${args.title}\nDescription: ${this.truncate(String(args.description || ''), 100)}`;

      case 'add_deal_note':
        return `Add note to deal:\n${this.truncate(String(args.content || ''), 150)}`;

      case 'create_task':
        return `Create task: ${args.title}${args.due_date ? `\nDue: ${args.due_date}` : ''}`;

      case 'sign_document':
        return `Sign document: ${args.document_id}`;

      default:
        return `Execute ${toolDef.description}\nParameters: ${JSON.stringify(args, null, 2)}`;
    }
  }

  // ---------------------------------------------------------------------------
  // TOOL EXECUTION
  // ---------------------------------------------------------------------------

  /**
   * Actually execute the tool (called after all checks pass).
   * This is a placeholder - actual implementations would be injected.
   */
  private async executeTool(
    toolCall: ToolCall,
    _toolDef: ToolDefinition,
    _context: ThreadContext
  ): Promise<unknown> {
    // Get the tool implementation
    const toolImpl = this.getToolImplementation(toolCall.toolName);
    if (!toolImpl) {
      throw new Error(`No implementation for tool: ${toolCall.toolName}`);
    }

    // Execute with context
    return await toolImpl(toolCall.args, _context);
  }

  /**
   * Get tool implementation function.
   * This should be replaced with actual tool implementations via dependency injection.
   */
  private getToolImplementation(
    _toolName: string
  ): ((args: Record<string, unknown>, ctx: ThreadContext) => Promise<unknown>) | null {
    // This is a placeholder - actual implementations would be registered
    // For now, return null to indicate no implementation
    return null;
  }

  /**
   * Register a tool implementation.
   * Call this to add actual tool handlers.
   */
  private toolImplementations: Map<
    string,
    (args: Record<string, unknown>, ctx: ThreadContext) => Promise<unknown>
  > = new Map();

  registerToolImplementation(
    toolName: string,
    implementation: (
      args: Record<string, unknown>,
      ctx: ThreadContext
    ) => Promise<unknown>
  ): void {
    if (!TOOL_REGISTRY[toolName]) {
      throw new Error(`Cannot register implementation for unknown tool: ${toolName}`);
    }
    this.toolImplementations.set(toolName, implementation);
  }

  // ---------------------------------------------------------------------------
  // LOGGING & EVENTS
  // ---------------------------------------------------------------------------

  private async logExecution(
    toolCall: ToolCall,
    result: unknown,
    run: AgentRun,
    executionType: 'auto' | 'approved',
    approvedBy?: string
  ): Promise<void> {
    await this.config.database.executionLogs.create({
      runId: run.id,
      toolCallId: toolCall.id,
      toolName: toolCall.toolName,
      args: toolCall.args,
      result,
      executionType,
      approvedBy,
      executedAt: new Date(),
    });
  }

  private async logError(
    toolCall: ToolCall,
    error: unknown,
    run: AgentRun
  ): Promise<void> {
    await this.config.database.executionLogs.create({
      runId: run.id,
      toolCallId: toolCall.id,
      toolName: toolCall.toolName,
      args: toolCall.args,
      error: error instanceof Error ? error.message : String(error),
      executedAt: new Date(),
    });
  }

  private async emitEvent(event: AgentEvent): Promise<void> {
    this.config.eventEmitter.emit('agent_event', event);

    // Also persist for audit
    await this.config.database.events.create({
      type: event.type,
      payload: event,
      timestamp: new Date(),
    });
  }

  // ---------------------------------------------------------------------------
  // UTILITIES
  // ---------------------------------------------------------------------------

  private truncate(str: string, length: number): string {
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
  }

  private async getContextFromRun(run: AgentRun): Promise<ThreadContext> {
    // Reconstruct context from run
    const thread = await this.config.database.threads.findById(run.threadId);
    return {
      operatorId: run.operatorId,
      dealId: run.dealId || thread?.dealId,
    };
  }

  // ---------------------------------------------------------------------------
  // PUBLIC QUERY METHODS
  // ---------------------------------------------------------------------------

  /**
   * Get pending approvals for an operator.
   */
  async getPendingApprovals(
    _operatorId: string
  ): Promise<ApprovalRequest[]> {
    // This would query the database for pending approvals
    // Implementation depends on the actual database layer
    return [];
  }

  /**
   * Check if a specific approval exists and is pending.
   */
  async isApprovalPending(approvalId: string): Promise<boolean> {
    const approval = await this.config.database.approvals.findById(approvalId);
    return approval?.status === 'pending';
  }

  /**
   * Expire old approval requests.
   */
  async expireOldApprovals(): Promise<number> {
    // This would be called by a background job
    // Implementation depends on the actual database layer
    return 0;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a configured ToolGateway instance.
 */
export function createToolGateway(config: GatewayConfig): ToolGateway {
  return new ToolGateway(config);
}

/**
 * Create a ToolGateway with default safety config.
 * Requires database and event emitter to be provided.
 */
export function createDefaultToolGateway(
  database: GatewayDatabase,
  eventEmitter: GatewayEventEmitter
): ToolGateway {
  return new ToolGateway({
    safetyConfig: DEFAULT_SAFETY_CONFIG,
    database,
    eventEmitter,
  });
}
