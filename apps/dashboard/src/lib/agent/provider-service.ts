/**
 * Agent Provider Service
 * ======================
 *
 * Configuration-driven provider initialization and management.
 * Reads AGENT_PROVIDER from environment to select the appropriate backend.
 *
 * Supported providers:
 * - local: ZakOps Agent API on port 8095 (default)
 * - Future: openai, anthropic, custom
 */

import type {
  AgentProvider,
  ProviderType,
  LocalProviderConfig,
} from './types';
import { LocalProvider, createLocalProvider } from './providers/local';

/**
 * Get the configured provider type from environment
 */
function getProviderType(): ProviderType {
  const provider = process.env.AGENT_PROVIDER?.toLowerCase() || 'local';

  if (['local', 'openai', 'anthropic', 'custom'].includes(provider)) {
    return provider as ProviderType;
  }

  console.warn(
    `[ProviderService] Unknown provider type: ${provider}, falling back to 'local'`
  );
  return 'local';
}

/**
 * Create the appropriate provider based on environment configuration
 */
function createProvider(): AgentProvider {
  const providerType = getProviderType();

  switch (providerType) {
    case 'local':
      return createLocalProvider();

    case 'openai':
      // Future: OpenAI provider
      console.warn('[ProviderService] OpenAI provider not yet implemented, using local');
      return createLocalProvider();

    case 'anthropic':
      // Future: Anthropic provider
      console.warn('[ProviderService] Anthropic provider not yet implemented, using local');
      return createLocalProvider();

    case 'custom':
      // Future: Custom provider via URL
      console.warn('[ProviderService] Custom provider not yet implemented, using local');
      return createLocalProvider();

    default:
      return createLocalProvider();
  }
}

/**
 * Singleton provider instance
 * Initialized lazily on first access
 */
let _provider: AgentProvider | null = null;

/**
 * Get the configured agent provider
 *
 * Returns a singleton instance configured from environment variables:
 * - AGENT_PROVIDER: Provider type (local|openai|anthropic|custom)
 * - AGENT_LOCAL_URL: URL for local provider (default: http://localhost:8095)
 * - AGENT_LOCAL_API_KEY or DASHBOARD_SERVICE_TOKEN: Authentication token
 * - AGENT_LOCAL_TIMEOUT: Request timeout in ms (default: 30000)
 *
 * @example
 * ```typescript
 * import { agentProvider } from '@/lib/agent/provider-service';
 *
 * // Check health
 * const healthy = await agentProvider.healthCheck();
 *
 * // Send chat request
 * const response = await agentProvider.chat({
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */
export function getAgentProvider(): AgentProvider {
  if (!_provider) {
    _provider = createProvider();
    console.log(`[ProviderService] Initialized ${_provider.name} provider`);
  }
  return _provider;
}

/**
 * Reset the provider instance (useful for testing)
 */
export function resetAgentProvider(): void {
  _provider = null;
}

/**
 * Default export: The singleton agent provider
 */
export const agentProvider = {
  /**
   * Get the provider instance
   */
  get instance(): AgentProvider {
    return getAgentProvider();
  },

  /**
   * Provider name
   */
  get name(): string {
    return getAgentProvider().name;
  },

  /**
   * Check if provider is healthy
   */
  healthCheck(): Promise<boolean> {
    return getAgentProvider().healthCheck();
  },

  /**
   * Send a chat request
   */
  chat: (request: Parameters<AgentProvider['chat']>[0]) => {
    return getAgentProvider().chat(request);
  },

  /**
   * Send a streaming chat request
   */
  chatStream: (request: Parameters<AgentProvider['chat']>[0]) => {
    const provider = getAgentProvider();
    if (provider.chatStream) {
      return provider.chatStream(request);
    }
    throw new Error(`Provider ${provider.name} does not support streaming`);
  },
};

// Re-export types for convenience
export type { AgentProvider, AgentRequest, AgentResponse, AgentStreamChunk } from './types';
