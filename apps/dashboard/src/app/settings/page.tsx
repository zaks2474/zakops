'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  IconServer,
  IconBrandOpenai,
  IconRobot,
  IconCloud,
  IconCheck,
  IconX,
  IconLoader2,
  IconRefresh,
  IconEye,
  IconEyeOff,
} from '@tabler/icons-react';
import {
  getSettings,
  saveSettings,
  testConnection,
  PROVIDER_MODELS,
  type ProviderSettings,
  type ProviderType,
} from '@/lib/settings/provider-settings';

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

interface ProviderStatus {
  status: ConnectionStatus;
  message: string;
  model?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [providerStatus, setProviderStatus] = useState<Record<ProviderType, ProviderStatus>>({
    local: { status: 'idle', message: '' },
    openai: { status: 'idle', message: '' },
    anthropic: { status: 'idle', message: '' },
    custom: { status: 'idle', message: '' },
  });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    setSettings(getSettings());
  }, []);

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleProviderChange = (provider: ProviderType) => {
    const newSettings = { ...settings, activeProvider: provider };
    setSettings(newSettings);
  };

  const handleLocalSettingChange = (key: keyof typeof settings.local, value: string | boolean) => {
    setSettings({
      ...settings,
      local: { ...settings.local, [key]: value },
    });
  };

  const handleOpenAISettingChange = (key: keyof typeof settings.openai, value: string | boolean) => {
    setSettings({
      ...settings,
      openai: { ...settings.openai, [key]: value },
    });
  };

  const handleAnthropicSettingChange = (key: keyof typeof settings.anthropic, value: string | boolean) => {
    setSettings({
      ...settings,
      anthropic: { ...settings.anthropic, [key]: value },
    });
  };

  const handleCustomSettingChange = (key: keyof typeof settings.custom, value: string | boolean) => {
    setSettings({
      ...settings,
      custom: { ...settings.custom, [key]: value },
    });
  };

  const handleTestConnection = async (provider: ProviderType) => {
    setProviderStatus((prev) => ({
      ...prev,
      [provider]: { status: 'testing', message: 'Testing connection...' },
    }));

    const result = await testConnection(provider);

    setProviderStatus((prev) => ({
      ...prev,
      [provider]: {
        status: result.success ? 'success' : 'error',
        message: result.message,
        model: result.model,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      saveSettings(settings);
      // Test the active provider after saving
      await handleTestConnection(settings.activeProvider);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleKeyVisibility = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getProviderIcon = (provider: ProviderType) => {
    switch (provider) {
      case 'local':
        return <IconServer className="h-5 w-5" />;
      case 'openai':
        return <IconBrandOpenai className="h-5 w-5" />;
      case 'anthropic':
        return <IconRobot className="h-5 w-5" />;
      case 'custom':
        return <IconCloud className="h-5 w-5" />;
    }
  };

  const getStatusIcon = (status: ConnectionStatus) => {
    switch (status) {
      case 'testing':
        return <IconLoader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <IconCheck className="h-4 w-4 text-green-500" />;
      case 'error':
        return <IconX className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure your AI provider and model preferences.
        </p>
      </div>

      {/* Provider Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Provider</CardTitle>
          <CardDescription>
            Select the AI provider for chat. Local vLLM (Qwen) is the primary provider with cloud Claude as automatic fallback.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(['local', 'openai', 'anthropic', 'custom'] as ProviderType[]).map((provider) => (
            <div
              key={provider}
              className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                settings.activeProvider === provider
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => handleProviderChange(provider)}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    settings.activeProvider === provider
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  }`}
                >
                  {settings.activeProvider === provider && (
                    <div className="w-full h-full rounded-full bg-primary" />
                  )}
                </div>
                {getProviderIcon(provider)}
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {provider === 'local' && 'Local vLLM (Qwen)'}
                    {provider === 'openai' && 'OpenAI'}
                    {provider === 'anthropic' && 'Anthropic Claude'}
                    {provider === 'custom' && 'Custom Endpoint'}
                    {provider === 'local' && (
                      <Badge variant="secondary" className="text-xs">Primary</Badge>
                    )}
                    {provider === 'anthropic' && (
                      <Badge variant="outline" className="text-xs">Fallback</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {provider === 'local' && 'Qwen 2.5 32B running on local infrastructure'}
                    {provider === 'openai' && 'GPT-4o, GPT-4 Turbo, GPT-3.5'}
                    {provider === 'anthropic' && 'Claude 3.5 Sonnet, Claude 3 Opus'}
                    {provider === 'custom' && 'OpenAI-compatible API endpoint'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(providerStatus[provider].status)}
                {providerStatus[provider].status !== 'idle' && (
                  <span className={`text-sm ${
                    providerStatus[provider].status === 'success' ? 'text-green-500' :
                    providerStatus[provider].status === 'error' ? 'text-red-500' :
                    'text-muted-foreground'
                  }`}>
                    {providerStatus[provider].message}
                  </span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Local Provider Configuration */}
      {settings.activeProvider === 'local' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconServer className="h-5 w-5" />
              Local vLLM Configuration
            </CardTitle>
            <CardDescription>
              Configure the local Agent API connection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="local-endpoint">Endpoint URL</Label>
              <Input
                id="local-endpoint"
                value={settings.local.endpoint}
                onChange={(e) => handleLocalSettingChange('endpoint', e.target.value)}
                placeholder="http://localhost:8095"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="local-model">Model</Label>
              <Select
                value={settings.local.model}
                onValueChange={(v) => handleLocalSettingChange('model', v)}
              >
                <SelectTrigger id="local-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_MODELS.local.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => handleTestConnection('local')}
              disabled={providerStatus.local.status === 'testing'}
            >
              {providerStatus.local.status === 'testing' ? (
                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <IconRefresh className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* OpenAI Configuration */}
      {settings.activeProvider === 'openai' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconBrandOpenai className="h-5 w-5" />
              OpenAI Configuration
            </CardTitle>
            <CardDescription>
              Configure OpenAI API access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="openai-key"
                  type={showKeys['openai'] ? 'text' : 'password'}
                  value={settings.openai.apiKey}
                  onChange={(e) => handleOpenAISettingChange('apiKey', e.target.value)}
                  placeholder="sk-..."
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleKeyVisibility('openai')}
                >
                  {showKeys['openai'] ? (
                    <IconEyeOff className="h-4 w-4" />
                  ) : (
                    <IconEye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="openai-model">Model</Label>
              <Select
                value={settings.openai.model}
                onValueChange={(v) => handleOpenAISettingChange('model', v)}
              >
                <SelectTrigger id="openai-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_MODELS.openai.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => handleTestConnection('openai')}
              disabled={providerStatus.openai.status === 'testing'}
            >
              {providerStatus.openai.status === 'testing' ? (
                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <IconRefresh className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Anthropic Configuration */}
      {settings.activeProvider === 'anthropic' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconRobot className="h-5 w-5" />
              Anthropic Configuration
            </CardTitle>
            <CardDescription>
              Configure Anthropic Claude API access. Note: Claude is used as automatic fallback when local vLLM fails.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="anthropic-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="anthropic-key"
                  type={showKeys['anthropic'] ? 'text' : 'password'}
                  value={settings.anthropic.apiKey}
                  onChange={(e) => handleAnthropicSettingChange('apiKey', e.target.value)}
                  placeholder="sk-ant-..."
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleKeyVisibility('anthropic')}
                >
                  {showKeys['anthropic'] ? (
                    <IconEyeOff className="h-4 w-4" />
                  ) : (
                    <IconEye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="anthropic-model">Model</Label>
              <Select
                value={settings.anthropic.model}
                onValueChange={(v) => handleAnthropicSettingChange('model', v)}
              >
                <SelectTrigger id="anthropic-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_MODELS.anthropic.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => handleTestConnection('anthropic')}
              disabled={providerStatus.anthropic.status === 'testing'}
            >
              {providerStatus.anthropic.status === 'testing' ? (
                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <IconRefresh className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Custom Provider Configuration */}
      {settings.activeProvider === 'custom' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconCloud className="h-5 w-5" />
              Custom Provider Configuration
            </CardTitle>
            <CardDescription>
              Configure a custom OpenAI-compatible API endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-endpoint">Endpoint URL</Label>
              <Input
                id="custom-endpoint"
                value={settings.custom.endpoint}
                onChange={(e) => handleCustomSettingChange('endpoint', e.target.value)}
                placeholder="https://api.example.com/v1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-key">API Key (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="custom-key"
                  type={showKeys['custom'] ? 'text' : 'password'}
                  value={settings.custom.apiKey}
                  onChange={(e) => handleCustomSettingChange('apiKey', e.target.value)}
                  placeholder="Optional API key"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleKeyVisibility('custom')}
                >
                  {showKeys['custom'] ? (
                    <IconEyeOff className="h-4 w-4" />
                  ) : (
                    <IconEye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-model">Model Name</Label>
              <Input
                id="custom-model"
                value={settings.custom.model}
                onChange={(e) => handleCustomSettingChange('model', e.target.value)}
                placeholder="model-name"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => handleTestConnection('custom')}
              disabled={providerStatus.custom.status === 'testing'}
            >
              {providerStatus.custom.status === 'testing' ? (
                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <IconRefresh className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Architecture Note */}
      <Card className="mb-6 bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-2">Architecture Note</h3>
          <p className="text-sm text-muted-foreground">
            The ZakOps Agent API uses a <strong>local-first architecture</strong>:
          </p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
            <li><strong>Primary:</strong> Local vLLM (Qwen 2.5 32B) on port 8095</li>
            <li><strong>Fallback:</strong> Cloud Claude (automatic when local fails)</li>
            <li>Sensitive data (SSN, tax IDs, bank accounts) is blocked from cloud providers</li>
          </ul>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => setSettings(getSettings())}>
          Reset
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <IconCheck className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
