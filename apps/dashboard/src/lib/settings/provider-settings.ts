/**
 * Provider Settings Storage
 * =========================
 *
 * Manages provider configuration with localStorage persistence.
 * Supports local vLLM (primary), cloud Claude (fallback), and future OpenAI/custom providers.
 */

export type ProviderType = 'local' | 'openai' | 'anthropic' | 'custom';

export interface LocalProviderSettings {
  endpoint: string;
  model: string;
  enabled: boolean;
}

export interface OpenAIProviderSettings {
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface AnthropicProviderSettings {
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface CustomProviderSettings {
  endpoint: string;
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface ProviderSettings {
  activeProvider: ProviderType;

  local: LocalProviderSettings;
  openai: OpenAIProviderSettings;
  anthropic: AnthropicProviderSettings;
  custom: CustomProviderSettings;
}

const STORAGE_KEY = 'zakops-provider-settings';

const DEFAULT_SETTINGS: ProviderSettings = {
  activeProvider: 'local',

  local: {
    endpoint: 'http://localhost:8095',
    model: 'Qwen/Qwen2.5-32B-Instruct-AWQ',
    enabled: true,
  },

  openai: {
    apiKey: '',
    model: 'gpt-4o',
    enabled: false,
  },

  anthropic: {
    apiKey: '',
    model: 'claude-3-5-sonnet-20241022',
    enabled: false,  // Fallback is handled server-side
  },

  custom: {
    endpoint: '',
    apiKey: '',
    model: '',
    enabled: false,
  },
};

/**
 * Get current provider settings from localStorage
 */
export function getSettings(): ProviderSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ProviderSettings>;
      // Merge with defaults to ensure all fields exist
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        local: { ...DEFAULT_SETTINGS.local, ...parsed.local },
        openai: { ...DEFAULT_SETTINGS.openai, ...parsed.openai },
        anthropic: { ...DEFAULT_SETTINGS.anthropic, ...parsed.anthropic },
        custom: { ...DEFAULT_SETTINGS.custom, ...parsed.custom },
      };
    }
  } catch (e) {
    console.error('Failed to load provider settings:', e);
  }

  return DEFAULT_SETTINGS;
}

/**
 * Save provider settings to localStorage
 */
export function saveSettings(settings: ProviderSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save provider settings:', e);
  }
}

/**
 * Get the active provider type
 */
export function getActiveProvider(): ProviderType {
  return getSettings().activeProvider;
}

/**
 * Set the active provider type
 */
export function setActiveProvider(provider: ProviderType): void {
  const settings = getSettings();
  settings.activeProvider = provider;
  saveSettings(settings);
}

/**
 * Test connection to a provider
 */
export async function testConnection(provider: ProviderType): Promise<{ success: boolean; message: string; model?: string }> {
  const settings = getSettings();

  try {
    switch (provider) {
      case 'local': {
        // Test local Agent API health
        const response = await fetch('/api/chat', { method: 'GET' });
        if (response.ok) {
          const data = await response.json();
          return {
            success: data.status === 'available',
            message: data.status === 'available'
              ? `Connected to ${data.provider}`
              : data.error || 'Connection failed',
            model: data.agent_health?.model || settings.local.model,
          };
        }
        return { success: false, message: 'Failed to connect to Agent API' };
      }

      case 'openai': {
        if (!settings.openai.apiKey) {
          return { success: false, message: 'API key not configured' };
        }
        // Test would require backend route - for now just validate key format
        if (settings.openai.apiKey.startsWith('sk-')) {
          return { success: true, message: 'API key format valid (not tested)', model: settings.openai.model };
        }
        return { success: false, message: 'Invalid API key format' };
      }

      case 'anthropic': {
        if (!settings.anthropic.apiKey) {
          return { success: false, message: 'API key not configured' };
        }
        // Test would require backend route - for now just validate key format
        if (settings.anthropic.apiKey.startsWith('sk-ant-')) {
          return { success: true, message: 'API key format valid (not tested)', model: settings.anthropic.model };
        }
        return { success: false, message: 'Invalid API key format' };
      }

      case 'custom': {
        if (!settings.custom.endpoint) {
          return { success: false, message: 'Endpoint not configured' };
        }
        // Would need to test the custom endpoint
        return { success: true, message: 'Custom endpoint configured (not tested)' };
      }

      default:
        return { success: false, message: 'Unknown provider' };
    }
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : 'Connection test failed' };
  }
}

/**
 * Available models for each provider
 */
export const PROVIDER_MODELS = {
  local: [
    'Qwen/Qwen2.5-32B-Instruct-AWQ',
    'Qwen/Qwen2.5-7B-Instruct-AWQ',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ],
  anthropic: [
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ],
  custom: [],
};

/**
 * Reset settings to defaults
 */
export function resetSettings(): void {
  saveSettings(DEFAULT_SETTINGS);
}
