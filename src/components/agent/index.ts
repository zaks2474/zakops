/**
 * Agent Components Module
 *
 * Exports all agent-related UI components for the transparency panel.
 */

// Main panel component
export { AgentPanel, default as AgentPanelDefault } from './AgentPanel';

// Timeline components
export { AgentRunTimeline } from './AgentRunTimeline';

// Card components
export { ToolCallCard } from './ToolCallCard';
export { ApprovalCheckpoint } from './ApprovalCheckpoint';

// Display components
export { ReasoningDisplay, ThinkingIndicator } from './ReasoningDisplay';
export {
  EvidenceLinks,
  extractEvidenceFromToolOutput,
  type EvidenceItem,
  type EvidenceType,
} from './EvidenceLinks';

// Hooks
export {
  useAgentRun,
  getRiskLevelColor,
  getStatusColor,
  formatDuration,
  type AgentRunState,
  type RunProgress,
  type UseAgentRunOptions,
} from './hooks/useAgentRun';

export {
  useApprovalFlow,
  useSingleApproval,
  type ApprovalAction,
  type ApprovalResult,
  type UseApprovalFlowOptions,
  type ApprovalFlowState,
} from './hooks/useApprovalFlow';
