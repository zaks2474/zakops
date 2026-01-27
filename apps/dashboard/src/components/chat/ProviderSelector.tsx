'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { IconRobot, IconBrandOpenai, IconCloud, IconServer } from '@tabler/icons-react';

export type ProviderType = 'local' | 'openai' | 'anthropic' | 'custom';

interface ProviderOption {
  id: ProviderType;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
}

const PROVIDERS: ProviderOption[] = [
  {
    id: 'local',
    name: 'Local (Queen)',
    description: 'ZakOps vLLM Agent',
    icon: <IconServer className="h-4 w-4" />,
    enabled: true,
  },
  {
    id: 'openai',
    name: 'OpenAI GPT-4',
    description: 'OpenAI API',
    icon: <IconBrandOpenai className="h-4 w-4" />,
    enabled: false,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Anthropic API',
    icon: <IconRobot className="h-4 w-4" />,
    enabled: false,
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Custom endpoint',
    icon: <IconCloud className="h-4 w-4" />,
    enabled: false,
  },
];

const STORAGE_KEY = 'zakops-chat-provider';

interface ProviderSelectorProps {
  onSelect?: (provider: ProviderType) => void;
  className?: string;
}

export function ProviderSelector({ onSelect, className }: ProviderSelectorProps) {
  const [selected, setSelected] = useState<ProviderType>('local');

  // Load saved preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ProviderType;
      if (saved && PROVIDERS.find((p) => p.id === saved && p.enabled)) {
        setSelected(saved);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const handleSelect = (value: string) => {
    const provider = value as ProviderType;
    const option = PROVIDERS.find((p) => p.id === provider);
    if (!option?.enabled) return;

    setSelected(provider);
    try {
      localStorage.setItem(STORAGE_KEY, provider);
    } catch {
      // localStorage not available
    }
    onSelect?.(provider);
  };

  const current = PROVIDERS.find((p) => p.id === selected);

  return (
    <Select value={selected} onValueChange={handleSelect}>
      <SelectTrigger className={className || 'w-[180px]'}>
        <SelectValue>
          <div className="flex items-center gap-2">
            {current?.icon}
            <span>{current?.name}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PROVIDERS.map((provider) => (
          <SelectItem
            key={provider.id}
            value={provider.id}
            disabled={!provider.enabled}
            className={!provider.enabled ? 'opacity-50' : ''}
          >
            <div className="flex items-center gap-2">
              {provider.icon}
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span>{provider.name}</span>
                  {!provider.enabled && (
                    <Badge variant="outline" className="text-[10px] py-0">
                      soon
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {provider.description}
                </span>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Get the currently selected provider from localStorage
 */
export function getSelectedProvider(): ProviderType {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ProviderType;
    if (saved && PROVIDERS.find((p) => p.id === saved && p.enabled)) {
      return saved;
    }
  } catch {
    // localStorage not available
  }
  return 'local';
}

export { PROVIDERS };
