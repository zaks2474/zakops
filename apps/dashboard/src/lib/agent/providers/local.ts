/**
 * Local Agent Provider
 * ====================
 *
 * Provider implementation for the local vLLM Agent API on port 8095.
 * Uses X-Service-Token header for authentication.
 */

import type {
  AgentProvider,
  AgentRequest,
  AgentResponse,
  AgentStreamChunk,
  LocalProviderConfig,
} from '../types';

/**
 * Default configuration for local provider
 */
const DEFAULT_CONFIG: Partial<LocalProviderConfig> = {
  url: 'http://localhost:8095',
  timeout: 30000,
};

/**
 * Local vLLM Agent Provider
 *
 * Connects to the ZakOps Agent API running on port 8095.
 * Supports both synchronous chat and streaming responses.
 */
export class LocalProvider implements AgentProvider {
  readonly name = 'local';
  private readonly config: LocalProviderConfig;

  constructor(config: Partial<LocalProviderConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as LocalProviderConfig;
  }

  /**
   * Check if the Agent API is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.url}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('[LocalProvider] Health check failed:', error);
      return false;
    }
  }

  /**
   * Send a chat request and get a complete response
   */
  async chat(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout || 30000
      );

      const response = await fetch(
        `${this.config.url}/api/v1/chatbot/chat`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            messages: request.messages,
            session_id: request.session_id,
            ...request.options,
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Agent API returned ${response.status}: ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      // Handle response format from Agent API
      if (data.messages && Array.isArray(data.messages)) {
        // Agent API returns conversation history format
        const lastMessage = data.messages[data.messages.length - 1];
        return {
          content: lastMessage?.content || '',
          messages: data.messages,
          model_used: this.config.model || 'local-vllm',
          latency_ms: latencyMs,
          citations: data.citations || [],
          proposals: data.proposals || [],
          warnings: data.warnings || [],
        };
      }

      // Direct response format
      return {
        content: data.content || data.response || '',
        model_used: data.model_used || this.config.model || 'local-vllm',
        latency_ms: latencyMs,
        tokens_used: data.tokens_used,
        citations: data.citations || [],
        proposals: data.proposals || [],
        warnings: data.warnings || [],
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Agent API request timed out after ${this.config.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Send a chat request and get a streaming response
   */
  async *chatStream(request: AgentRequest): AsyncGenerator<AgentStreamChunk> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout || 30000
      );

      const response = await fetch(
        `${this.config.url}/api/v1/chatbot/chat/stream`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            messages: request.messages,
            session_id: request.session_id,
            ...request.options,
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Agent API stream returned ${response.status}: ${JSON.stringify(errorData)}`
        );
      }

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          yield { content: '', done: true };
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              yield {
                content: data.content || data.token || '',
                done: data.done || false,
              };
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Agent API stream timed out after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Get headers for API requests including authentication
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add service token for authentication
    if (this.config.serviceToken) {
      headers['X-Service-Token'] = this.config.serviceToken;
    }

    return headers;
  }
}

/**
 * Create a local provider with environment-based configuration
 */
export function createLocalProvider(
  config?: Partial<LocalProviderConfig>
): LocalProvider {
  return new LocalProvider({
    url: process.env.AGENT_LOCAL_URL ||
         process.env.NEXT_PUBLIC_AGENT_API_URL ||
         process.env.AGENT_API_URL ||
         'http://localhost:8095',
    serviceToken: process.env.AGENT_LOCAL_API_KEY ||
                  process.env.AGENT_SERVICE_TOKEN ||
                  process.env.DASHBOARD_SERVICE_TOKEN ||
                  '',
    timeout: parseInt(process.env.AGENT_LOCAL_TIMEOUT || '30000', 10),
    ...config,
  });
}
