/**
 * ZakOps Agent Module
 * ====================
 *
 * Exports for the agent infrastructure including:
 * - Agent Provider System (pluggable backends)
 * - Tool Registry
 * - Tool Gateway
 * - Safety Config
 */

// Tool Registry
export {
  TOOL_REGISTRY,
  getToolDefinition,
  getToolsByRiskLevel,
  getToolsByCategory,
  toolRequiresApproval,
  toolHasExternalImpact,
  getAllToolNames,
  getAutoExecutableTools,
  getToolManifestForLangSmith,
  type ToolDefinition,
  type ToolParameter,
  type ToolExample,
  type RiskLevel,
  type ToolCategory,
  type ToolScope,
  type ParameterType,
} from './toolRegistry';

// Tool Gateway
export {
  ToolGateway,
  createToolGateway,
  createDefaultToolGateway,
  type ToolCall,
  type AgentRun,
  type ThreadContext,
  type ApprovalRequest,
  type ToolExecutionResult,
  type AgentEvent,
  type GatewayDatabase,
  type GatewayEventEmitter,
  type GatewayConfig,
} from './toolGateway';

// Agent Provider System
export {
  agentProvider,
  getAgentProvider,
  resetAgentProvider,
  type AgentProvider,
  type AgentRequest,
  type AgentResponse,
  type AgentStreamChunk,
} from './provider-service';

export {
  LocalProvider,
  createLocalProvider,
} from './providers/local';

export type {
  AgentMessage,
  LocalProviderConfig,
  ProviderType,
  ProviderConfig,
  ProviderServiceConfig,
} from './types';
