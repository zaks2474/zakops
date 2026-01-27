'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconServer, IconSettings, IconCheck, IconLoader2 } from '@tabler/icons-react';
import { getSettings, type ProviderSettings } from '@/lib/settings/provider-settings';

export type ProviderType = 'local' | 'openai' | 'anthropic' | 'custom';

const PROVIDER_NAMES: Record<ProviderType, string> = {
  local: 'Local vLLM (Qwen)',
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
  custom: 'Custom',
};

interface ProviderSelectorProps {
  onSelect?: (provider: ProviderType) => void;
  className?: string;
}

export function ProviderSelector({ onSelect, className }: ProviderSelectorProps) {
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');

  // Load settings on mount
  useEffect(() => {
    setSettings(getSettings());
  }, []);

  // Check connection status
  useEffect(() => {
    const checkStatus = async () => {
      setStatus('checking');
      try {
        const response = await fetch('/api/chat');
        if (response.ok) {
          const data = await response.json();
          setStatus(data.status === 'available' ? 'connected' : 'error');
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    };

    checkStatus();
    // Re-check every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeProvider = settings?.activeProvider || 'local';

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
        <IconServer className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{PROVIDER_NAMES[activeProvider]}</span>
        {status === 'checking' && (
          <IconLoader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        )}
        {status === 'connected' && (
          <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-green-500/20 text-green-600">
            <IconCheck className="h-3 w-3" />
          </Badge>
        )}
        {status === 'error' && (
          <Badge variant="destructive" className="text-[10px] py-0">
            offline
          </Badge>
        )}
      </div>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/settings">
          <IconSettings className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

/**
 * Get the currently selected provider from settings
 */
export function getSelectedProvider(): ProviderType {
  return getSettings().activeProvider;
}
