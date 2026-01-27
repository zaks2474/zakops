/**
 * Agent Provider Types
 * ====================
 *
 * TypeScript interfaces for the pluggable agent provider system.
 * Supports multiple backends (local vLLM, OpenAI, Anthropic, etc.)
 */

/**
 * Message in a conversation
 */
export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Request to an agent provider
 */
export interface AgentRequest {
  messages: AgentMessage[];
  conversation_id?: string;
  session_id?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  options?: Record<string, unknown>;
}

/**
 * Response from an agent provider
 */
export interface AgentResponse {
  content: string;
  messages?: AgentMessage[];
  model_used: string;
  latency_ms: number;
  tokens_used?: {
    input: number;
    output: number;
  };
  citations?: unknown[];
  proposals?: unknown[];
  warnings?: string[];
}

/**
 * Streaming chunk from an agent provider
 */
export interface AgentStreamChunk {
  content: string;
  done: boolean;
}

/**
 * Agent provider interface - all providers must implement this
 */
export interface AgentProvider {
  /** Provider name for logging/identification */
  readonly name: string;

  /**
   * Check if the provider is healthy and reachable
   * @returns true if healthy, false otherwise
   */
  healthCheck(): Promise<boolean>;

  /**
   * Send a chat request and get a complete response
   * @param request The chat request
   * @returns The complete response
   */
  chat(request: AgentRequest): Promise<AgentResponse>;

  /**
   * Send a chat request and get a streaming response
   * @param request The chat request
   * @returns Async generator yielding content chunks
   */
  chatStream?(request: AgentRequest): AsyncGenerator<AgentStreamChunk>;
}

/**
 * Configuration for the local vLLM provider (port 8095)
 */
export interface LocalProviderConfig {
  /** Base URL of the Agent API (default: http://localhost:8095) */
  url: string;
  /** Service token for authentication */
  serviceToken?: string;
  /** Model name (optional, uses agent default if not specified) */
  model?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Supported provider types
 */
export type ProviderType = 'local' | 'openai' | 'anthropic' | 'custom';

/**
 * Provider configuration union type
 */
export type ProviderConfig = LocalProviderConfig;

/**
 * Provider service configuration from environment
 */
export interface ProviderServiceConfig {
  provider: ProviderType;
  config: ProviderConfig;
}
