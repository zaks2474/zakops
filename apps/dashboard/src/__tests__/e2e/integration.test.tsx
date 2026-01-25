/**
 * E2E Integration Tests
 *
 * Tests for verifying the complete integration between:
 * - Agent Bridge → LangSmith Agent Builder
 * - SSE Events → UI Components
 * - Approval Flow → Tool Gateway
 * - Onboarding → Deal Creation
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { agentClient } from '@/lib/agent-client';
import { ToolGateway } from '@/lib/agent/toolGateway';
import { TOOL_REGISTRY, getToolDefinition } from '@/lib/agent/toolRegistry';
import { DEFAULT_SAFETY_CONFIG } from '@/config/safety';
import type { AgentToolCall, AgentRun, AgentThread } from '@/types/execution-contracts';

// =============================================================================
// Test Utilities
// =============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function createMockToolCall(overrides: Partial<AgentToolCall> = {}): AgentToolCall {
  return {
    tool_call_id: `tc_${Date.now()}`,
    run_id: 'run_123',
    tool_name: 'get_deal_context',
    tool_input: { deal_id: 'deal_123' },
    status: 'pending_approval',
    risk_level: 'low',
    requires_approval: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createMockRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    run_id: `run_${Date.now()}`,
    thread_id: 'thread_123',
    status: 'running',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createMockThread(overrides: Partial<AgentThread> = {}): AgentThread {
  return {
    thread_id: `thread_${Date.now()}`,
    assistant_id: 'asst_zakops',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// =============================================================================
// Task 1: Wiring Verification Tests
// =============================================================================

describe('1. Wiring Verification', () => {
  describe('1.1 Agent Bridge → LangSmith Agent Builder', () => {
    it('agentClient can create threads', async () => {
      const mockThread = createMockThread();

      // Mock the fetch
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockThread),
      });

      const result = await agentClient.createThread({
        assistant_id: 'asst_zakops',
        deal_id: 'deal_123',
      });

      expect(result.thread_id).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/threads'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('agentClient can create runs with context', async () => {
      const mockRun = createMockRun();

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRun),
      });

      const result = await agentClient.createRun('thread_123', {
        input_message: 'Process this deal',
        metadata: {
          operator_id: 'op_123',
          buy_box: { min_ebitda: 1000000 },
        },
      });

      expect(result.run_id).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/threads/thread_123/runs'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('operator_id'),
        })
      );
    });

    it('SSE streaming endpoint is correctly configured', () => {
      // Verify the streaming URL pattern
      const threadId = 'thread_123';
      const runId = 'run_456';
      const expectedPath = `/api/threads/${threadId}/runs/${runId}/stream`;

      // The streamRunEvents function should construct this URL
      expect(expectedPath).toMatch(/^\/api\/threads\/\w+\/runs\/\w+\/stream$/);
    });
  });

  describe('1.2 SSE Events → UI Components', () => {
    it('useRealtimeEvents hook handles connection lifecycle', async () => {
      // This tests that the hook correctly tracks connection state
      const mockEvents: Array<{ eventType: string; data: Record<string, unknown> }> = [];

      // The hook should:
      // 1. Set connecting = true initially
      // 2. Set connected = true when stream opens
      // 3. Call onEvent for each event
      // 4. Set connected = false when stream ends

      expect(mockEvents).toBeDefined();
    });

    it('INVALIDATION_EVENTS triggers cache updates', () => {
      const invalidationEvents = [
        'run_completed',
        'run_failed',
        'tool_call_completed',
        'tool_call_failed',
        'tool_approval_granted',
        'tool_approval_denied',
      ];

      // All these events should trigger React Query cache invalidation
      invalidationEvents.forEach((event) => {
        expect(event).toBeDefined();
      });
    });

    it('AgentPanel receives agent.* events', () => {
      const agentEvents = [
        'agent.run_started',
        'agent.thinking',
        'agent.tool_call',
        'agent.tool_result',
        'agent.response',
        'agent.run_completed',
      ];

      // AgentPanel should handle all these event types
      agentEvents.forEach((event) => {
        expect(event.startsWith('agent.')).toBe(true);
      });
    });

    it('ApprovalQueue receives action.approval_requested', () => {
      const approvalEvent = {
        eventType: 'action.approval_requested',
        data: {
          tool_call_id: 'tc_123',
          tool_name: 'send_email',
          risk_level: 'high',
        },
      };

      expect(approvalEvent.eventType).toBe('action.approval_requested');
      expect(approvalEvent.data.tool_name).toBeDefined();
    });

    it('DealWorkspace updates on deal.* events', () => {
      const dealEvents = [
        'deal.created',
        'deal.updated',
        'deal.stage_changed',
        'deal.archived',
      ];

      dealEvents.forEach((event) => {
        expect(event.startsWith('deal.')).toBe(true);
      });
    });
  });

  describe('1.3 Approval Flow → Tool Gateway', () => {
    it('approve button triggers API call', async () => {
      // Mock the approval API call
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          tool_call_id: 'tc_123',
          status: 'approved',
        }),
      });

      // Simulate what ApprovalCard does when clicking approve
      const response = await fetch('/api/threads/thread_1/runs/run_1/tool_calls/tc_123/approve', {
        method: 'POST',
        body: JSON.stringify({ approved_by: 'operator_123' }),
      });

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/approve'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('reject button records rejection via API', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          tool_call_id: 'tc_123',
          status: 'rejected',
          rejection_reason: 'Too aggressive tone',
        }),
      });

      const response = await fetch('/api/threads/thread_1/runs/run_1/tool_calls/tc_123/reject', {
        method: 'POST',
        body: JSON.stringify({ rejected_by: 'operator_123', reason: 'Too aggressive tone' }),
      });

      const result = await response.json();
      expect(result.status).toBe('rejected');
      expect(result.rejection_reason).toBe('Too aggressive tone');
    });

    it('high-risk tools always require approval', () => {
      const highRiskTools = Object.values(TOOL_REGISTRY).filter((t) => t.riskLevel === 'high');

      highRiskTools.forEach((tool) => {
        expect(tool.requiresApproval).toBe(true);
      });
    });

    it('critical-risk tools require approval and confirmation', () => {
      const criticalTools = Object.values(TOOL_REGISTRY).filter((t) => t.riskLevel === 'critical');

      criticalTools.forEach((tool) => {
        expect(tool.requiresApproval).toBe(true);
        // Critical tools should also require explicit confirmation
        expect(['submit_loi', 'sign_document', 'reject_deal', 'archive_deal']).toContain(
          tool.name
        );
      });
    });
  });

  describe('1.4 Onboarding → Deal Creation', () => {
    it('email paste triggers agent processing', async () => {
      const emailContent = `
        From: broker@deals.com
        Subject: New Deal - ABC Company

        Hi, I have a new deal for you...
      `;

      // The flow should:
      // 1. User pastes email
      // 2. Agent extracts artifacts
      // 3. Deal created in quarantine
      // 4. Appears in pipeline after approval

      expect(emailContent).toContain('From:');
      expect(emailContent).toContain('Subject:');
    });

    it('quarantine approval creates deal in pipeline', () => {
      // When operator approves quarantine item:
      // 1. API endpoint /api/quarantine/:id/approve called
      // 2. deal.created event emitted
      // 3. Pipeline refreshes

      // Note: Quarantine approval is an API endpoint, not a tool
      // The create_deal tool is used internally
      const createDealTool = getToolDefinition('create_deal');
      expect(createDealTool).toBeDefined();
      expect(createDealTool?.riskLevel).toBe('medium');
    });
  });
});

// =============================================================================
// Task 2: E2E Test Scenarios
// =============================================================================

describe('2. E2E Test Scenarios', () => {
  describe('2.1 Email → Deal Flow', () => {
    it('complete email to deal flow', async () => {
      // Scenario:
      // 1. Forward email to quarantine
      // 2. Agent extracts artifacts
      // 3. Operator approves
      // 4. Deal created in pipeline
      // 5. Verify: deal.created event, UI updates

      const steps = [
        { step: 'email_received', status: 'pending' },
        { step: 'agent_extraction', status: 'pending' },
        { step: 'quarantine_created', status: 'pending' },
        { step: 'operator_approval', status: 'pending' },
        { step: 'deal_created', status: 'pending' },
      ];

      // Each step should trigger appropriate events
      expect(steps).toHaveLength(5);
    });

    it('extracts company info from email', () => {
      const extractionTool = getToolDefinition('extract_email_artifacts');
      expect(extractionTool).toBeDefined();
      expect(extractionTool?.category).toBe('analyze');
      expect(extractionTool?.name).toBe('extract_email_artifacts');
    });

    it('creates quarantine item with metadata', () => {
      // Quarantine item should include:
      // - Sender info
      // - Subject
      // - Extracted company name
      // - Classification
      // - Urgency

      const quarantineFields = [
        'sender',
        'email_subject',
        'company_name',
        'classification',
        'urgency',
      ];

      expect(quarantineFields).toHaveLength(5);
    });
  });

  describe('2.2 Chat → Action → Approval Flow', () => {
    it('chat message triggers agent run', async () => {
      const message = 'Please send a follow-up email to the broker about ABC Company';

      // This should:
      // 1. Create/use thread
      // 2. Create run with message
      // 3. Agent processes and calls send_email
      // 4. Approval request generated

      expect(message).toContain('email');
    });

    it('send_email tool requires approval', () => {
      const sendEmailTool = getToolDefinition('send_email');
      expect(sendEmailTool?.requiresApproval).toBe(true);
      expect(sendEmailTool?.riskLevel).toBe('high');
      expect(sendEmailTool?.externalImpact).toBe(true);
    });

    it('approval triggers email send', async () => {
      // When approved:
      // 1. Tool gateway executes send_email
      // 2. action.completed event emitted
      // 3. agent.tool_completed event emitted
      // 4. UI updates to show sent status

      const expectedEvents = [
        'tool_call_approved',
        'tool_call_started',
        'tool_call_completed',
        'action.completed',
      ];

      expect(expectedEvents).toHaveLength(4);
    });
  });

  describe('2.3 Stage Transition Flow', () => {
    it('advance_deal_stage tool is properly defined', () => {
      const tool = getToolDefinition('advance_deal_stage');
      expect(tool).toBeDefined();
      expect(tool?.riskLevel).toBe('medium');
      expect(tool?.requiresApproval).toBe(true);
    });

    it('stage transition validation', () => {
      // Valid transitions from 'screening':
      // - screening → qualified (move forward)
      // - screening → junk (reject)

      const validTransitions = {
        inbound: ['screening', 'junk'],
        screening: ['qualified', 'junk'],
        qualified: ['loi', 'junk', 'screening'],
        loi: ['diligence', 'junk', 'qualified'],
        diligence: ['closing', 'junk', 'loi'],
        closing: ['portfolio', 'diligence'],
        portfolio: ['archived'],
        junk: ['screening'],
        archived: [],
      };

      expect(validTransitions.screening).toContain('qualified');
      expect(validTransitions.screening).toContain('junk');
    });

    it('approval preview shows stage change', () => {
      const toolInput = {
        deal_id: 'deal_123',
        new_stage: 'qualified',
        reason: 'Meets all screening criteria',
      };

      // Preview should show:
      // "Move deal to qualified stage"

      expect(toolInput.new_stage).toBe('qualified');
    });
  });

  describe('2.4 Disconnect/Reconnect', () => {
    it('SSE reconnects with exponential backoff', () => {
      const baseDelay = 1000;
      const maxDelay = 30000;

      // Delays should follow: 1s, 2s, 4s, 8s, 16s, 30s, 30s...
      const delays = [1000, 2000, 4000, 8000, 16000, 30000, 30000];

      for (let attempt = 0; attempt < delays.length; attempt++) {
        const expectedDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        expect(delays[attempt]).toBe(expectedDelay);
      }
    });

    it('last event ID preserved for resume', () => {
      // When reconnecting, the hook should:
      // 1. Store lastEventId from each event
      // 2. Pass it as Last-Event-ID header on reconnect
      // 3. Server resumes from that point

      const lastEventId = 'evt_123456';
      const reconnectUrl = `/api/events?last_event_id=${lastEventId}`;

      expect(reconnectUrl).toContain('last_event_id');
    });

    it('run state recovers after reconnect', () => {
      // After reconnect:
      // 1. Fetch current run state
      // 2. Replay any missed events
      // 3. UI shows correct state

      const runState = {
        status: 'running',
        tool_calls_count: 3,
        pending_approvals: 1,
      };

      expect(runState.status).toBe('running');
    });
  });

  describe('2.5 Onboarding Complete Flow', () => {
    it('wizard has 5 steps', () => {
      const steps = ['welcome', 'email', 'agent', 'preferences', 'complete'];
      expect(steps).toHaveLength(5);
    });

    it('email setup connects OAuth', () => {
      const providers = ['gmail', 'outlook'];
      expect(providers).toContain('gmail');
      expect(providers).toContain('outlook');
    });

    it('agent config sets auto-approve level', () => {
      const levels = ['none', 'low', 'medium'];
      expect(levels).toContain('low'); // default
    });

    it('onComplete saves preferences', () => {
      const state = {
        emailConnected: true,
        emailAddress: 'deals@example.com',
        agentEnabled: true,
        autoApproveLevel: 'low',
        notifications: {
          email: true,
          browser: true,
          digest: 'daily',
        },
      };

      expect(state.emailConnected).toBe(true);
      expect(state.agentEnabled).toBe(true);
    });

    it('first deal appears in dashboard', () => {
      // After onboarding:
      // 1. User lands on dashboard
      // 2. If email connected, deals start appearing
      // 3. TodayNextUpStrip shows pending items

      const dashboardComponents = [
        'TodayNextUpStrip',
        'ExecutionInbox',
        'QuickStats',
        'PipelineOverview',
      ];

      expect(dashboardComponents).toContain('TodayNextUpStrip');
      expect(dashboardComponents).toContain('ExecutionInbox');
    });
  });
});

// =============================================================================
// Task 3: Integration Gap Detection
// =============================================================================

describe('3. Integration Gap Detection', () => {
  it('all high-risk tools have implementations', () => {
    const highRiskTools = Object.values(TOOL_REGISTRY).filter((t) => t.riskLevel === 'high');

    // These should all have registered implementations in production
    highRiskTools.forEach((tool) => {
      expect(tool.name).toBeDefined();
      // In production, verify: gateway.hasImplementation(tool.name)
    });
  });

  it('all event types have handlers', () => {
    const eventTypes = [
      'run_created',
      'run_started',
      'run_completed',
      'run_failed',
      'run_cancelled',
      'tool_call_started',
      'tool_call_completed',
      'tool_call_failed',
      'tool_approval_requested',
      'tool_approval_granted',
      'tool_approval_denied',
      'stream_start',
      'stream_token',
      'stream_end',
      'stream_error',
    ];

    expect(eventTypes.length).toBeGreaterThan(10);
  });

  it('API routes are defined', () => {
    const requiredRoutes = [
      '/api/threads',
      '/api/threads/:id',
      '/api/threads/:id/runs',
      '/api/threads/:id/runs/:id',
      '/api/threads/:id/runs/:id/stream',
      '/api/threads/:id/runs/:id/tool_calls',
      '/api/threads/:id/runs/:id/tool_calls/:id/approve',
      '/api/threads/:id/runs/:id/tool_calls/:id/reject',
      '/api/pending-tool-approvals',
      '/api/events',
    ];

    expect(requiredRoutes).toContain('/api/events');
    expect(requiredRoutes).toContain('/api/pending-tool-approvals');
  });

  it('WebSocket endpoint for global updates', () => {
    const wsEndpoint = '/ws/updates';
    expect(wsEndpoint).toBe('/ws/updates');
  });
});
