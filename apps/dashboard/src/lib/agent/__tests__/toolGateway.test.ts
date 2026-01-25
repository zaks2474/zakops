/**
 * Tool Gateway Contract Enforcement Tests
 * =========================================
 *
 * Verifies that the Tool Gateway correctly enforces the agent contract.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ToolGateway,
  ToolCall,
  AgentRun,
  GatewayDatabase,
  GatewayEventEmitter,
  GatewayConfig,
} from '../toolGateway';
import { TOOL_REGISTRY } from '../toolRegistry';
import {
  DEFAULT_SAFETY_CONFIG,
  SafetyConfig,
} from '@/config/safety';

// =============================================================================
// MOCK FACTORIES
// =============================================================================

function createMockDatabase(): GatewayDatabase {
  return {
    approvals: {
      create: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(undefined),
    },
    toolCalls: {
      countByRun: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue(undefined),
    },
    runs: {
      findById: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(undefined),
      countRecentByOperator: vi.fn().mockResolvedValue(0),
    },
    threads: {
      findById: vi.fn().mockResolvedValue({ operatorId: 'op-1' }),
    },
    executionLogs: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    events: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function createMockEventEmitter(): GatewayEventEmitter {
  return {
    emit: vi.fn(),
  };
}

function createToolCall(
  toolName: string,
  args: Record<string, unknown>
): ToolCall {
  const toolDef = TOOL_REGISTRY[toolName];
  return {
    id: crypto.randomUUID(),
    toolName,
    args,
    status: 'pending',
    riskLevel: toolDef?.riskLevel || 'medium',
    requiresApproval: toolDef?.requiresApproval ?? true,
    startedAt: new Date(),
  };
}

function createRun(overrides?: Partial<AgentRun>): AgentRun {
  return {
    id: crypto.randomUUID(),
    threadId: crypto.randomUUID(),
    assistantId: 'test-assistant',
    status: 'running',
    input: 'test input',
    toolCalls: [],
    outputs: [],
    startedAt: new Date(),
    idempotencyKey: 'test-key',
    operatorId: 'op-1',
    ...overrides,
  };
}

// =============================================================================
// TEST SUITE
// =============================================================================

describe('ToolGateway Contract Enforcement', () => {
  let gateway: ToolGateway;
  let mockDb: GatewayDatabase;
  let mockEmitter: GatewayEventEmitter;

  beforeEach(() => {
    mockDb = createMockDatabase();
    mockEmitter = createMockEventEmitter();
    gateway = new ToolGateway({
      safetyConfig: DEFAULT_SAFETY_CONFIG,
      database: mockDb,
      eventEmitter: mockEmitter,
    });
  });

  // ---------------------------------------------------------------------------
  // LOW RISK TOOLS
  // ---------------------------------------------------------------------------

  describe('Low Risk Tools', () => {
    it('should auto-execute get_deal_context without approval', async () => {
      const toolCall = createToolCall('get_deal_context', {
        deal_id: 'abc-123',
      });
      const run = createRun();

      // Register a mock implementation
      gateway.registerToolImplementation(
        'get_deal_context',
        async () => ({ deal: { name: 'Test' } })
      );

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('executed');
      expect(mockDb.approvals.create).not.toHaveBeenCalled();
    });

    it('should auto-execute search_documents without approval', async () => {
      const toolCall = createToolCall('search_documents', {
        query: 'revenue',
      });
      const run = createRun();

      gateway.registerToolImplementation(
        'search_documents',
        async () => ({ results: [] })
      );

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('executed');
    });

    it('should auto-execute analyze_financials without approval', async () => {
      const toolCall = createToolCall('analyze_financials', {
        deal_id: 'abc-123',
      });
      const run = createRun();

      gateway.registerToolImplementation(
        'analyze_financials',
        async () => ({ revenue: {}, sde: {} })
      );

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('executed');
    });
  });

  // ---------------------------------------------------------------------------
  // MEDIUM RISK TOOLS
  // ---------------------------------------------------------------------------

  describe('Medium Risk Tools', () => {
    it('should require approval for create_deal', async () => {
      const toolCall = createToolCall('create_deal', {
        name: 'Test Business',
        source: 'Quiet Light',
      });
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('waiting_approval');
      expect(result.approvalId).toBeDefined();
      expect(mockDb.approvals.create).toHaveBeenCalled();
      expect(mockEmitter.emit).toHaveBeenCalledWith(
        'agent_event',
        expect.objectContaining({ type: 'action.approval_requested' })
      );
    });

    it('should require approval for advance_deal_stage', async () => {
      const toolCall = createToolCall('advance_deal_stage', {
        deal_id: 'abc-123',
        new_stage: 'qualified',
        reason: 'Meets buy box',
      });
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('waiting_approval');
    });

    it('should require approval for draft_broker_response', async () => {
      const toolCall = createToolCall('draft_broker_response', {
        deal_id: 'abc-123',
        intent: 'Request financials',
      });
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('waiting_approval');
    });

    it('should NOT require approval for tag_deal (low impact)', async () => {
      const toolCall = createToolCall('tag_deal', {
        deal_id: 'abc-123',
        tags: ['hot-lead', 'saas'],
      });
      const run = createRun();

      gateway.registerToolImplementation(
        'tag_deal',
        async () => ({ updated: true, tags: ['hot-lead', 'saas'] })
      );

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      // tag_deal has requiresApproval: false
      expect(result.status).toBe('executed');
    });
  });

  // ---------------------------------------------------------------------------
  // HIGH RISK TOOLS
  // ---------------------------------------------------------------------------

  describe('High Risk Tools', () => {
    it('should ALWAYS require approval for send_email', async () => {
      const toolCall = createToolCall('send_email', {
        to: 'broker@example.com',
        subject: 'Test',
        body: 'Test email',
      });
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('waiting_approval');
    });

    it('should require approval for send_email even if config allows auto-execute', async () => {
      // Create gateway with permissive config
      const permissiveGateway = new ToolGateway({
        safetyConfig: {
          ...DEFAULT_SAFETY_CONFIG,
          AUTO_EXECUTE_ENABLED: true,
          AUTO_EXECUTE_LOW_RISK_TOOLS: true,
          AUTO_EXECUTE_MEDIUM_RISK_TOOLS: true,
        },
        database: mockDb,
        eventEmitter: mockEmitter,
      });

      const toolCall = createToolCall('send_email', {
        to: 'broker@example.com',
        subject: 'Test',
        body: 'Test email',
      });

      const result = await permissiveGateway.executeToolCall(
        toolCall,
        createRun(),
        { operatorId: 'op-1' }
      );

      // Still requires approval because externalImpact = true
      expect(result.status).toBe('waiting_approval');
    });

    it('should require approval for schedule_meeting', async () => {
      const toolCall = createToolCall('schedule_meeting', {
        title: 'Intro Call',
        attendees: ['broker@example.com'],
        datetime: '2026-01-20T10:00:00Z',
        duration: 30,
      });
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('waiting_approval');
    });

    it('should require approval for request_documents', async () => {
      const toolCall = createToolCall('request_documents', {
        deal_id: 'abc-123',
        documents: ['tax returns', 'P&L'],
      });
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('waiting_approval');
    });

    it('should require approval for share_deal', async () => {
      const toolCall = createToolCall('share_deal', {
        deal_id: 'abc-123',
        recipient_email: 'advisor@example.com',
        permission: 'view',
      });
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('waiting_approval');
    });
  });

  // ---------------------------------------------------------------------------
  // CRITICAL TOOLS
  // ---------------------------------------------------------------------------

  describe('Critical Tools', () => {
    it('should ALWAYS require approval for submit_loi', async () => {
      const toolCall = createToolCall('submit_loi', {
        deal_id: 'abc-123',
        loi_draft_id: 'draft-456',
        delivery_method: 'email',
      });
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('waiting_approval');
    });

    it('should ALWAYS require approval for sign_document', async () => {
      const toolCall = createToolCall('sign_document', {
        deal_id: 'abc-123',
        document_id: 'doc-789',
      });
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('waiting_approval');
    });

    it('should ALWAYS require approval for reject_deal', async () => {
      const toolCall = createToolCall('reject_deal', {
        deal_id: 'abc-123',
        reason: 'Does not fit buy box',
        notify_broker: true,
      });
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('waiting_approval');
    });

    it('should ALWAYS require approval for archive_deal', async () => {
      const toolCall = createToolCall('archive_deal', {
        deal_id: 'abc-123',
        reason: 'Deal closed - lost',
      });
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('waiting_approval');
    });
  });

  // ---------------------------------------------------------------------------
  // SAFETY KILL SWITCH
  // ---------------------------------------------------------------------------

  describe('Safety Kill Switch', () => {
    it('should require approval for ALL tools when AUTO_EXECUTE_ENABLED = false', async () => {
      const restrictedGateway = new ToolGateway({
        safetyConfig: {
          ...DEFAULT_SAFETY_CONFIG,
          AUTO_EXECUTE_ENABLED: false,
        },
        database: mockDb,
        eventEmitter: mockEmitter,
      });

      // Even a low-risk tool should require approval
      const toolCall = createToolCall('get_deal_context', {
        deal_id: 'abc-123',
      });
      const result = await restrictedGateway.executeToolCall(
        toolCall,
        createRun(),
        { operatorId: 'op-1' }
      );

      expect(result.status).toBe('waiting_approval');
    });

    it('should block disabled tools entirely', async () => {
      const restrictedGateway = new ToolGateway({
        safetyConfig: {
          ...DEFAULT_SAFETY_CONFIG,
          DISABLED_TOOLS: ['send_email'],
        },
        database: mockDb,
        eventEmitter: mockEmitter,
      });

      const toolCall = createToolCall('send_email', {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test',
      });

      const result = await restrictedGateway.executeToolCall(
        toolCall,
        createRun(),
        { operatorId: 'op-1' }
      );

      expect(result.status).toBe('error');
      expect(result.error).toContain('disabled');
    });
  });

  // ---------------------------------------------------------------------------
  // APPROVAL FLOW
  // ---------------------------------------------------------------------------

  describe('Approval Flow', () => {
    it('should execute tool after approval', async () => {
      // Create approval request
      const toolCall = createToolCall('send_email', {
        to: 'broker@example.com',
        subject: 'Test',
        body: 'Test email',
      });
      const run = createRun();

      const requestResult = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });
      expect(requestResult.status).toBe('waiting_approval');

      // Mock finding the approval
      const mockApproval = {
        id: requestResult.approvalId!,
        runId: run.id,
        toolCallId: toolCall.id,
        toolName: 'send_email',
        args: toolCall.args,
        riskLevel: 'high' as const,
        preview: 'Send email...',
        evidence: [],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'pending' as const,
      };
      mockDb.approvals.findById = vi.fn().mockResolvedValue(mockApproval);
      mockDb.runs.findById = vi.fn().mockResolvedValue(run);

      // Register implementation
      gateway.registerToolImplementation(
        'send_email',
        async () => ({ sent: true, message_id: 'msg-123' })
      );

      // Process approval
      const approvalResult = await gateway.processApproval(
        requestResult.approvalId!,
        'approve',
        { id: 'op-1', name: 'Test Operator' }
      );

      expect(approvalResult.status).toBe('executed');
    });

    it('should not execute tool after rejection', async () => {
      const toolCall = createToolCall('send_email', {
        to: 'broker@example.com',
        subject: 'Test',
        body: 'Test email',
      });
      const run = createRun();

      const requestResult = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      // Mock finding the approval
      const mockApproval = {
        id: requestResult.approvalId!,
        runId: run.id,
        toolCallId: toolCall.id,
        toolName: 'send_email',
        args: toolCall.args,
        riskLevel: 'high' as const,
        preview: 'Send email...',
        evidence: [],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'pending' as const,
      };
      mockDb.approvals.findById = vi.fn().mockResolvedValue(mockApproval);

      const rejectionResult = await gateway.processApproval(
        requestResult.approvalId!,
        'reject',
        { id: 'op-1', name: 'Test Operator' },
        undefined,
        'Not appropriate'
      );

      expect(rejectionResult.status).toBe('rejected');
    });

    it('should fail if approval is expired', async () => {
      // Mock finding an expired approval
      const mockApproval = {
        id: 'expired-approval',
        runId: 'run-1',
        toolCallId: 'tc-1',
        toolName: 'send_email',
        args: {},
        riskLevel: 'high' as const,
        preview: 'Send email...',
        evidence: [],
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
        status: 'pending' as const,
      };
      mockDb.approvals.findById = vi.fn().mockResolvedValue(mockApproval);

      const result = await gateway.processApproval(
        'expired-approval',
        'approve',
        { id: 'op-1', name: 'Test Operator' }
      );

      expect(result.status).toBe('error');
      expect(result.error).toContain('expired');
    });
  });

  // ---------------------------------------------------------------------------
  // VALIDATION
  // ---------------------------------------------------------------------------

  describe('Parameter Validation', () => {
    it('should reject tool call with missing required parameter', async () => {
      const toolCall = createToolCall('get_deal_context', {}); // Missing deal_id
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('error');
      expect(result.error).toContain('Missing required parameter');
    });

    it('should reject unknown tool', async () => {
      const toolCall: ToolCall = {
        id: crypto.randomUUID(),
        toolName: 'unknown_tool',
        args: { foo: 'bar' },
        status: 'pending',
        riskLevel: 'medium',
        requiresApproval: true,
        startedAt: new Date(),
      };
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('error');
      expect(result.error).toContain('Unknown tool');
    });

    it('should validate parameter types', async () => {
      const toolCall = createToolCall('search_documents', {
        query: 123, // Should be string
      });
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('error');
      expect(result.error).toContain('expected string');
    });
  });

  // ---------------------------------------------------------------------------
  // RATE LIMITING
  // ---------------------------------------------------------------------------

  describe('Rate Limiting', () => {
    it('should block when max tool calls per run exceeded', async () => {
      // Simulate 50 previous tool calls
      mockDb.toolCalls.countByRun = vi.fn().mockResolvedValue(50);

      const toolCall = createToolCall('get_deal_context', {
        deal_id: 'abc',
      });
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('error');
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('should block when max runs per minute exceeded', async () => {
      // Simulate many recent runs
      mockDb.runs.countRecentByOperator = vi.fn().mockResolvedValue(15);

      const toolCall = createToolCall('get_deal_context', {
        deal_id: 'abc',
      });
      const run = createRun();

      const result = await gateway.executeToolCall(toolCall, run, {
        operatorId: 'op-1',
      });

      expect(result.status).toBe('error');
      expect(result.error).toContain('Rate limit exceeded');
    });
  });

  // ---------------------------------------------------------------------------
  // EVENT EMISSION
  // ---------------------------------------------------------------------------

  describe('Event Emission', () => {
    it('should emit approval_requested event when approval needed', async () => {
      const toolCall = createToolCall('create_deal', {
        name: 'Test',
        source: 'Test',
      });
      const run = createRun();

      await gateway.executeToolCall(toolCall, run, { operatorId: 'op-1' });

      expect(mockEmitter.emit).toHaveBeenCalledWith(
        'agent_event',
        expect.objectContaining({
          type: 'action.approval_requested',
          payload: expect.objectContaining({
            toolName: 'create_deal',
            riskLevel: 'medium',
          }),
        })
      );
    });

    it('should emit tool_completed event after successful execution', async () => {
      const toolCall = createToolCall('get_deal_context', {
        deal_id: 'abc-123',
      });
      const run = createRun();

      gateway.registerToolImplementation(
        'get_deal_context',
        async () => ({ deal: {} })
      );

      await gateway.executeToolCall(toolCall, run, { operatorId: 'op-1' });

      expect(mockEmitter.emit).toHaveBeenCalledWith(
        'agent_event',
        expect.objectContaining({
          type: 'agent.tool_completed',
          payload: expect.objectContaining({
            toolName: 'get_deal_context',
            success: true,
          }),
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // PREVIEW GENERATION
  // ---------------------------------------------------------------------------

  describe('Preview Generation', () => {
    it('should generate readable preview for send_email', async () => {
      const toolCall = createToolCall('send_email', {
        to: 'broker@example.com',
        subject: 'Follow-up on TechWidget',
        body: 'Hello, I am interested in learning more about the opportunity...',
      });
      const run = createRun();

      await gateway.executeToolCall(toolCall, run, { operatorId: 'op-1' });

      expect(mockDb.approvals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          preview: expect.stringContaining('broker@example.com'),
        })
      );
    });

    it('should generate readable preview for advance_deal_stage', async () => {
      const toolCall = createToolCall('advance_deal_stage', {
        deal_id: 'abc-123',
        new_stage: 'qualified',
        reason: 'Meets all criteria',
      });
      const run = createRun();

      await gateway.executeToolCall(toolCall, run, { operatorId: 'op-1' });

      expect(mockDb.approvals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          preview: expect.stringContaining('qualified'),
        })
      );
    });
  });
});

// =============================================================================
// TOOL REGISTRY TESTS
// =============================================================================

describe('Tool Registry', () => {
  it('should have all expected low-risk tools', () => {
    const lowRiskTools = [
      'get_deal_context',
      'get_operator_context',
      'search_documents',
      'extract_email_artifacts',
      'analyze_financials',
      'calculate_valuation',
      'score_buy_box_fit',
      'get_comparable_deals',
      'summarize_document',
    ];

    for (const toolName of lowRiskTools) {
      expect(TOOL_REGISTRY[toolName]).toBeDefined();
      expect(TOOL_REGISTRY[toolName].riskLevel).toBe('low');
    }
  });

  it('should have all expected high-risk tools', () => {
    const highRiskTools = [
      'send_email',
      'schedule_meeting',
      'request_documents',
      'share_deal',
    ];

    for (const toolName of highRiskTools) {
      expect(TOOL_REGISTRY[toolName]).toBeDefined();
      expect(TOOL_REGISTRY[toolName].riskLevel).toBe('high');
      expect(TOOL_REGISTRY[toolName].externalImpact).toBe(true);
    }
  });

  it('should have all expected critical tools', () => {
    const criticalTools = [
      'submit_loi',
      'sign_document',
      'reject_deal',
      'archive_deal',
    ];

    for (const toolName of criticalTools) {
      expect(TOOL_REGISTRY[toolName]).toBeDefined();
      expect(TOOL_REGISTRY[toolName].riskLevel).toBe('critical');
      expect(TOOL_REGISTRY[toolName].requiresApproval).toBe(true);
    }
  });

  it('should mark all external-impact tools as requiring approval', () => {
    for (const [_, tool] of Object.entries(TOOL_REGISTRY)) {
      if (tool.externalImpact) {
        expect(tool.requiresApproval).toBe(true);
      }
    }
  });

  it('should have valid parameter definitions for all tools', () => {
    for (const [toolName, tool] of Object.entries(TOOL_REGISTRY)) {
      expect(tool.parameters).toBeInstanceOf(Array);
      for (const param of tool.parameters) {
        expect(param.name).toBeDefined();
        expect(param.type).toBeDefined();
        expect(typeof param.required).toBe('boolean');
        expect(param.description).toBeDefined();
      }
    }
  });
});
